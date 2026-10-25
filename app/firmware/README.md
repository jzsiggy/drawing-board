# Frame firmware

`frame/` is the sketch that runs on the ESP32-S3-ePaper-13.3E6. It sleeps,
wakes every few minutes, asks the server whether the image changed, and only
then downloads and refreshes. Protocol: `../docs/frame-protocol.md`.

`test-server/` is a local stand-in for the real API, for testing on your Wi-Fi.

## Setup

1. `cp frame/config.example.h frame/config.h` and fill in Wi-Fi, the server URL
   and the board token. `config.h` is gitignored.
2. Put an image in `test-server/images/` and start the server (prints the URL
   to use as `SERVER_BASE_URL`):

   ```sh
   uv run app/firmware/test-server/server.py
   ```

3. Flash and watch the log (from the repo root):

   ```sh
   arduino-cli compile --upload -p /dev/cu.usbmodem21101 --fqbn "esp32:esp32:esp32s3:CDCOnBoot=cdc,FlashSize=32M,PartitionScheme=app5M_fat24M_32MB,PSRAM=opi" app/firmware/frame && arduino-cli monitor -p /dev/cu.usbmodem21101 -c baudrate=115200
   ```

Drop a different image into `test-server/images/` to make the frame update on
its next check, or press BOOT to make it check right away.

While the frame is in deep sleep its USB serial port disappears; it comes back
on each wake. To flash a sleeping frame, hold BOOT, tap RESET, release BOOT.
