// Copy this file to config.h and fill it in. config.h is gitignored.
#pragma once

#define WIFI_SSID     "your-wifi"
#define WIFI_PASSWORD "your-password"

// The local test server or `next dev` on your Mac ("http://192.168.1.20:8787"
// or ":3000"), or the deployed app ("https://your-app.vercel.app").
#define SERVER_BASE_URL "http://192.168.1.20:8787"
#define BOARD_TOKEN     "dev-token"

// Optional static IP: skips DHCP, which makes each wake shorter.
// #define STATIC_IP      192, 168, 1, 50
// #define STATIC_GATEWAY 192, 168, 1, 1
// #define STATIC_SUBNET  255, 255, 255, 0
// #define STATIC_DNS     192, 168, 1, 1

// Button that wakes the frame for an immediate check (active low).
// GPIO0 is the BOOT button on most ESP32-S3 boards; comment out to disable.
#define WAKE_BUTTON_GPIO 0

// Below this the frame skips Wi-Fi entirely and sleeps for 6 hours to protect
// the LiPo. Readings under 1000 mV are treated as "no battery" and ignored.
#define LOW_BATTERY_FLOOR_MV 3300
