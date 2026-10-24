// Minimal "show some text" sketch for the Waveshare ESP32-S3-ePaper-13.3E6.
// The driver files next to this sketch come from Waveshare's 03_E-Paper_Example:
// https://github.com/waveshareteam/ESP32-S3-ePaper-13.3E6

#include "EPD_13in3e.h"
#include "GUI_Paint.h"
#include "fonts.h"

// The built-in fonts top out at 24px tall, which is tiny on a 13.3" panel,
// so draw each font pixel as a scale x scale block.
void drawStringScaled(UWORD x, UWORD y, const char *text, sFONT *font,
                      UBYTE scale, UWORD fg) {
    UWORD bytesPerRow = font->Width / 8 + (font->Width % 8 ? 1 : 0);
    for (; *text; text++, x += font->Width * scale) {
        const unsigned char *glyph = &font->table[(*text - ' ') * font->Height * bytesPerRow];
        for (UWORD row = 0; row < font->Height; row++) {
            for (UWORD col = 0; col < font->Width; col++) {
                if (glyph[row * bytesPerRow + col / 8] & (0x80 >> (col % 8))) {
                    UWORD px = x + col * scale;
                    UWORD py = y + row * scale;
                    Paint_DrawRectangle(px, py, px + scale, py + scale, fg,
                                        DOT_PIXEL_1X1, DRAW_FILL_FULL);
                }
            }
        }
    }
}

void setup() {
    DEV_Module_Init();
    printf("Hello e-paper\r\n");

    EPD_13IN3E_Init();

    // 4 bits per pixel: 1200 * 1600 / 2 = 960,000 bytes, so it has to live in PSRAM.
    size_t imageSize = (size_t)(EPD_13IN3E_WIDTH / 2) * EPD_13IN3E_HEIGHT;
    UBYTE *image = (UBYTE *)ps_malloc(imageSize);
    if (image == NULL) {
        printf("Failed to allocate image buffer. Is PSRAM enabled?\r\n");
        DEV_Module_Exit();
        while (1);
    }

    // Rotate 90 degrees so we draw on a 1600 x 1200 landscape canvas.
    Paint_NewImage(image, EPD_13IN3E_WIDTH, EPD_13IN3E_HEIGHT, 90, EPD_13IN3E_WHITE);
    Paint_SetScale(6);
    Paint_SelectImage(image);
    Paint_Clear(EPD_13IN3E_WHITE);

    drawStringScaled(100, 150, "Hello, world!", &Font24, 6, EPD_13IN3E_BLACK);
    drawStringScaled(100, 450, "ESP32-S3 e-paper", &Font24, 4, EPD_13IN3E_RED);
    drawStringScaled(100, 650, "13.3 inch Spectra 6", &Font24, 4, EPD_13IN3E_BLUE);
    Paint_DrawString_EN(100, 1000, "Built-in Font24, unscaled", &Font24,
                        EPD_13IN3E_GREEN, EPD_13IN3E_WHITE);

    printf("Refreshing display (takes a while)...\r\n");
    EPD_13IN3E_Display(image);

    // The panel keeps the image with no power, so put it to sleep and cut its 5V.
    EPD_13IN3E_Sleep();
    free(image);
    DEV_Module_Exit();
    printf("Done\r\n");
}

void loop() {
}
