import { VexFlow } from "vexflow";
import bravuraUrl from "./fonts/Bravura.otf?url";

/**
 * Load the bundled Bravura music font and point VexFlow at it. VexFlow expects
 * the family name "Bravura", so the face is registered under that name.
 * Bravura is licensed under the SIL OFL; see src/fonts/OFL.txt.
 */
export async function loadMusicFont(): Promise<void> {
  VexFlow.setFonts("Bravura");

  if (typeof document === "undefined" || !("fonts" in document)) return;

  try {
    const face = new FontFace("Bravura", `url(${bravuraUrl}) format("opentype")`);
    await face.load();
    document.fonts.add(face);
  } catch {
    // A system Bravura is the fallback.
  }
}
