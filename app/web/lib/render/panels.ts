// E-ink panels the server can render for. A board's panel_type is a key here.

export type Rgb = readonly [number, number, number];

// RGB used for dithering, and the 4-bit code the panel expects for it.
export interface PaletteEntry {
  rgb: Rgb;
  code: number;
}

export type PaletteName = "ideal" | "measured";

export interface Panel {
  // Panel type byte in the frame file header (app/docs/frame-protocol.md).
  headerId: number;
  width: number;
  height: number;
  palettes: Record<PaletteName, PaletteEntry[]>;
}

export const PANELS = {
  "spectra6-13in3": {
    headerId: 1,
    width: 1200,
    height: 1600,
    palettes: {
      // Pure primaries: what the panel is asked to show.
      ideal: [
        { rgb: [0, 0, 0], code: 0x0 }, // black
        { rgb: [255, 255, 255], code: 0x1 }, // white
        { rgb: [255, 255, 0], code: 0x2 }, // yellow
        { rgb: [255, 0, 0], code: 0x3 }, // red
        { rgb: [0, 0, 255], code: 0x5 }, // blue
        { rgb: [0, 255, 0], code: 0x6 }, // green
      ],
      // What the inks actually look like, from Pimoroni's driver for the same
      // EL133UF1 panel (SATURATED_PALETTE in inky/inky_el133uf1.py).
      measured: [
        { rgb: [0, 0, 0], code: 0x0 },
        { rgb: [161, 164, 165], code: 0x1 },
        { rgb: [208, 190, 71], code: 0x2 },
        { rgb: [156, 72, 75], code: 0x3 },
        { rgb: [61, 59, 94], code: 0x5 },
        { rgb: [58, 91, 70], code: 0x6 },
      ],
    },
  },
} satisfies Record<string, Panel>;

export type PanelType = keyof typeof PANELS;

export function getPanel(panelType: string): Panel {
  if (!(panelType in PANELS)) throw new Error(`Unknown panel type: ${panelType}`);
  return PANELS[panelType as PanelType];
}
