// Shows a pre-dithered image on the Waveshare ESP32-S3-ePaper-13.3E6.
// Put a .jpg/.png in input/, run `uv run convert.py` to generate image_data.h,
// then compile and flash this sketch.

#include "EPD_13in3e.h"

#if __has_include("image_data.h")
#include "image_data.h"
#else
#error "image_data.h not found: put an image in input/ and run `uv run convert.py` first"
#endif

void setup() {
    DEV_Module_Init();
    printf("Image dither\r\n");

    EPD_13IN3E_Init();

    // image_data is already in the panel's 4-bit format, so it can be sent
    // straight from flash without a RAM buffer.
    printf("Refreshing display (takes a while)...\r\n");
    EPD_13IN3E_Display(image_data);

    // The panel keeps the image with no power, so put it to sleep and cut its 5V.
    EPD_13IN3E_Sleep();
    DEV_Module_Exit();
    printf("Done\r\n");
}

void loop() {
}
