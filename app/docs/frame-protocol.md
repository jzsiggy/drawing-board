# Frame protocol

How the e-ink frame talks to the server. The firmware (`app/firmware/frame`), the
local test server (`app/firmware/test-server`) and the real API (Vercel) all
follow this document. Change it here first.

The frame always starts the conversation: it wakes from deep sleep, makes one
small request, and only downloads anything if the image changed.

## Authentication and telemetry

Every request to `/api/frame/*` sends:

| Header | Example | Meaning |
|---|---|---|
| `Authorization` | `Bearer 3f9c…` | Per-board secret. The server stores only its hash. |
| `X-Battery-mV` | `3912` | Battery voltage in millivolts (0 if unknown). |
| `X-RSSI` | `-61` | Wi-Fi signal strength in dBm. |
| `X-Firmware` | `0.1.0` | Firmware version. |

An unknown or missing token gets `401`.

## `GET /api/frame/state`

Asks whether there is a new image. The frame sends the SHA-256 of the image it
is showing as `If-None-Match: "<sha256 hex>"`, or omits the header if it has
never shown one.

Every `200` and `304` response carries `X-Next-Check: <seconds>`: how long the
frame should sleep before checking again. The server owns the schedule.

- **`304 Not Modified`**: nothing to do (the hash matches, or there is no image
  yet). No body.
- **`200 OK`**: a different image should be shown. Flat JSON body (no nesting,
  so the firmware can parse it without a library):

  ```json
  {"sha256": "9b1f…64 hex chars", "url": "https://…/frames/9b1f….bin", "bytes": 960016}
  ```

  `url` may be a short-lived signed link and needs no auth header.

Anything else (network error, `5xx`, malformed body) is a failed check: the
frame backs off (120 s, doubling up to 1 hour) and tries again.

## `POST /api/frame/ack`

Sent after the panel has finished refreshing. Body: `{"sha256": "…"}`. Reply
`204`. If the ack never arrives, the server treats the frame's next
`If-None-Match` hash as the ack.

## Frame file

`bytes` long, all integers little-endian:

| Offset | Size | Field | Value |
|---|---|---|---|
| 0 | 4 | magic | `EPD1` |
| 4 | 1 | format version | `1` |
| 5 | 1 | panel type | `1` = 13.3" Spectra 6 (1200 × 1600) |
| 6 | 2 | reserved | `0` |
| 8 | 2 | width | `1200` |
| 10 | 2 | height | `1600` |
| 12 | 4 | payload length | `960000` |
| 16 | … | payload | 4-bit panel colour codes, 2 pixels per byte, left pixel in the high nibble, rows top to bottom |

The payload is exactly what `EPD_13IN3E_Display()` takes. Colour codes: black
0, white 1, yellow 2, red 3, blue 5, green 6.

The frame refreshes only when the whole file has arrived, its header matches the
panel, and its SHA-256 equals the `sha256` from the state response.
