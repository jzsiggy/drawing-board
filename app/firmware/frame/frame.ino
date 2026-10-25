// Frame firmware: wake, ask the server whether the image changed, download and
// show it only if it did, then deep sleep. Everything happens in setup(); each
// wake is a fresh boot. Protocol: app/docs/frame-protocol.md

#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <esp_sleep.h>
#include <esp_timer.h>
#include <driver/gpio.h>
#include <driver/rtc_io.h>
#include <mbedtls/sha256.h>
#include <algorithm>

#include "config.h"
#include "EPD_13in3e.h"

#define FIRMWARE_VERSION "0.1.0"

static const uint32_t DEFAULT_CHECK_S = 600;
static const uint32_t MIN_BACKOFF_S = 120;
static const uint32_t MAX_BACKOFF_S = 3600;
static const uint32_t LOW_BATTERY_SLEEP_S = 6 * 3600;
static const uint64_t MAX_AWAKE_US = 90ULL * 1000 * 1000;

static const size_t HEADER_SIZE = 16;
static const size_t PAYLOAD_SIZE = (size_t)(EPD_13IN3E_WIDTH / 2) * EPD_13IN3E_HEIGHT;

// Battery voltage on ADC1 channel 7 (GPIO8) through a 1/3 divider, as in
// Waveshare's 01_ADC_Test.
static const int BATTERY_ADC_GPIO = 8;

// Kept across deep sleep (lost if power is removed).
RTC_DATA_ATTR static uint8_t rtcBssid[6];
RTC_DATA_ATTR static int32_t rtcChannel = 0;
RTC_DATA_ATTR static uint32_t rtcBackoffS = 0;

static int batteryMv = 0;
static int rssi = 0;
static String currentSha;

struct State {
    bool ok;
    bool changed;
    uint32_t nextCheckS;
    String sha;
    String url;
    size_t bytes;
};

// ---------------------------------------------------------------- sleep

static void holdPanelPowerOff() {
    pinMode(EPD_PWR_PIN, OUTPUT);
    digitalWrite(EPD_PWR_PIN, LOW);
    gpio_hold_en((gpio_num_t)EPD_PWR_PIN);
}

static void enableWakeSources(uint32_t seconds) {
    esp_sleep_enable_timer_wakeup((uint64_t)seconds * 1000000ULL);
#ifdef WAKE_BUTTON_GPIO
    rtc_gpio_pullup_en((gpio_num_t)WAKE_BUTTON_GPIO);
    esp_sleep_enable_ext0_wakeup((gpio_num_t)WAKE_BUTTON_GPIO, 0);
#endif
}

static uint32_t failureSleepSeconds() {
    rtcBackoffS = rtcBackoffS ? std::min(rtcBackoffS * 2, MAX_BACKOFF_S) : MIN_BACKOFF_S;
    return rtcBackoffS;
}

static void goToSleep(uint32_t seconds) {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    holdPanelPowerOff();
    enableWakeSources(seconds);
    Serial.printf("Awake %lu ms, sleeping %lu s\n", millis(), (unsigned long)seconds);
    Serial.flush();
    esp_deep_sleep_start();
}

// Last resort if anything hangs: runs on the esp_timer task, so it skips the
// Wi-Fi teardown and goes straight to sleep.
static void onAwakeTooLong(void *) {
    holdPanelPowerOff();
    enableWakeSources(failureSleepSeconds());
    esp_deep_sleep_start();
}

static void startAwakeLimit() {
    esp_timer_create_args_t args = {};
    args.callback = onAwakeTooLong;
    args.name = "awake-limit";
    esp_timer_handle_t timer;
    esp_timer_create(&args, &timer);
    esp_timer_start_once(timer, MAX_AWAKE_US);
}

// ---------------------------------------------------------------- Wi-Fi

static bool waitForWifi(uint32_t timeoutMs) {
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > timeoutMs) return false;
        delay(20);
    }
    return true;
}

static bool rememberAccessPoint() {
    rtcChannel = WiFi.channel();
    memcpy(rtcBssid, WiFi.BSSID(), sizeof(rtcBssid));
    rssi = WiFi.RSSI();
    return true;
}

// Reconnecting to the remembered channel and access point skips the scan,
// which is most of the time a normal connect takes.
static bool connectWifi() {
    WiFi.mode(WIFI_STA);
#ifdef STATIC_IP
    WiFi.config(IPAddress(STATIC_IP), IPAddress(STATIC_GATEWAY),
                IPAddress(STATIC_SUBNET), IPAddress(STATIC_DNS));
#endif
    if (rtcChannel > 0) {
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD, rtcChannel, rtcBssid);
        if (waitForWifi(4000)) return rememberAccessPoint();
        WiFi.disconnect();
    }
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    if (waitForWifi(15000)) return rememberAccessPoint();
    rtcChannel = 0;
    Serial.println("Wi-Fi connect failed");
    return false;
}

// ---------------------------------------------------------------- server

static void addFrameHeaders(HTTPClient &http) {
    http.addHeader("Authorization", "Bearer " BOARD_TOKEN);
    http.addHeader("X-Battery-mV", String(batteryMv));
    http.addHeader("X-RSSI", String(rssi));
    http.addHeader("X-Firmware", FIRMWARE_VERSION);
}

// The server sends a flat JSON object, so a string search is enough.
static String jsonValue(const String &body, const char *key) {
    String needle = String("\"") + key + "\"";
    int at = body.indexOf(needle);
    if (at < 0) return "";
    at = body.indexOf(':', at + needle.length());
    if (at < 0) return "";
    at++;
    while (at < (int)body.length() && body[at] == ' ') at++;
    if (body[at] == '"') {
        int end = body.indexOf('"', at + 1);
        return end < 0 ? "" : body.substring(at + 1, end);
    }
    int end = at;
    while (end < (int)body.length() && isdigit((unsigned char)body[end])) end++;
    return body.substring(at, end);
}

static State fetchState() {
    State state = {false, false, DEFAULT_CHECK_S, "", "", 0};
    HTTPClient http;
    http.begin(String(SERVER_BASE_URL) + "/api/frame/state");
    addFrameHeaders(http);
    if (currentSha.length()) http.addHeader("If-None-Match", "\"" + currentSha + "\"");
    const char *wanted[] = {"X-Next-Check"};
    http.collectHeaders(wanted, 1);

    int code = http.GET();
    long next = http.header("X-Next-Check").toInt();
    if (next > 0) state.nextCheckS = next;

    if (code == 304) {
        state.ok = true;
    } else if (code == 200) {
        String body = http.getString();
        state.sha = jsonValue(body, "sha256");
        state.url = jsonValue(body, "url");
        state.bytes = jsonValue(body, "bytes").toInt();
        state.ok = state.changed = state.sha.length() == 64 && state.url.length() > 0;
        if (!state.ok) Serial.printf("Malformed state: %s\n", body.c_str());
    } else {
        Serial.printf("State request failed: %d\n", code);
    }
    http.end();
    return state;
}

static uint32_t readLE(const uint8_t *p, int size) {
    uint32_t value = 0;
    for (int i = size - 1; i >= 0; i--) value = (value << 8) | p[i];
    return value;
}

static bool frameIsValid(const uint8_t *buf, size_t len, const String &expectedSha) {
    if (memcmp(buf, "EPD1", 4) != 0 || buf[4] != 1 || buf[5] != 1 ||
        readLE(buf + 8, 2) != EPD_13IN3E_WIDTH || readLE(buf + 10, 2) != EPD_13IN3E_HEIGHT ||
        readLE(buf + 12, 4) != PAYLOAD_SIZE) {
        Serial.println("Frame header does not match this panel");
        return false;
    }
    uint8_t digest[32];
    mbedtls_sha256(buf, len, digest, 0);
    char hex[65];
    for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", digest[i]);
    if (!expectedSha.equalsIgnoreCase(hex)) {
        Serial.println("Frame SHA-256 mismatch");
        return false;
    }
    return true;
}

// Returns a PSRAM buffer holding the whole verified file, or nullptr.
static uint8_t *downloadFrame(const State &state) {
    if (state.bytes != HEADER_SIZE + PAYLOAD_SIZE) {
        Serial.printf("Unexpected frame size %u\n", (unsigned)state.bytes);
        return nullptr;
    }
    uint8_t *buf = (uint8_t *)ps_malloc(state.bytes);
    if (!buf) {
        Serial.println("No PSRAM for the frame");
        return nullptr;
    }

    HTTPClient http;
    http.begin(state.url);
    size_t got = 0;
    if (http.GET() == 200) {
        WiFiClient *stream = http.getStreamPtr();
        uint32_t deadline = millis() + 30000;
        while (got < state.bytes && (http.connected() || stream->available()) && millis() < deadline) {
            size_t available = stream->available();
            if (available) {
                got += stream->readBytes(buf + got, std::min(available, state.bytes - got));
            } else {
                delay(1);
            }
        }
    }
    http.end();

    if (got != state.bytes || !frameIsValid(buf, state.bytes, state.sha)) {
        Serial.printf("Download failed (%u of %u bytes)\n", (unsigned)got, (unsigned)state.bytes);
        free(buf);
        return nullptr;
    }
    return buf;
}

static void sendAck(const String &sha) {
    HTTPClient http;
    http.begin(String(SERVER_BASE_URL) + "/api/frame/ack");
    addFrameHeaders(http);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST("{\"sha256\":\"" + sha + "\"}");
    if (code != 204) Serial.printf("Ack failed: %d (the next check will ack instead)\n", code);
    http.end();
}

// ---------------------------------------------------------------- panel

static void showFrame(const uint8_t *frame) {
    gpio_hold_dis((gpio_num_t)EPD_PWR_PIN);
    DEV_Module_Init();
    EPD_13IN3E_Init();
    EPD_13IN3E_Display(frame + HEADER_SIZE);
    EPD_13IN3E_Sleep();
    DEV_Module_Exit();
}

static int readBatteryMv() {
    return analogReadMilliVolts(BATTERY_ADC_GPIO) * 3;
}

// ---------------------------------------------------------------- main

void setup() {
    Serial.begin(115200);
    startAwakeLimit();
    gpio_hold_dis((gpio_num_t)EPD_PWR_PIN);

    batteryMv = readBatteryMv();
    Serial.printf("Frame %s, wake cause %d, battery %d mV\n",
                  FIRMWARE_VERSION, (int)esp_sleep_get_wakeup_cause(), batteryMv);
    if (batteryMv > 1000 && batteryMv < LOW_BATTERY_FLOOR_MV) {
        Serial.println("Battery too low, skipping Wi-Fi");
        goToSleep(LOW_BATTERY_SLEEP_S);
    }

    Preferences prefs;
    prefs.begin("frame", false);
    currentSha = prefs.getString("sha", "");

    if (!connectWifi()) goToSleep(failureSleepSeconds());
    State state = fetchState();
    if (!state.ok) goToSleep(failureSleepSeconds());

    if (state.changed) {
        Serial.printf("New image %s\n", state.sha.c_str());
        uint8_t *frame = downloadFrame(state);
        if (!frame) goToSleep(failureSleepSeconds());

        // The refresh takes ~30 s; the radio stays off for it.
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        showFrame(frame);
        free(frame);

        currentSha = state.sha;
        prefs.putString("sha", currentSha);
        if (connectWifi()) sendAck(currentSha);
    } else {
        Serial.println("No change");
    }

    rtcBackoffS = 0;
    goToSleep(state.nextCheckS);
}

void loop() {
}
