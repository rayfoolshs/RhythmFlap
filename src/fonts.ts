import { VexFlow } from "vexflow";
import bravuraUrl from "./fonts/Bravura.otf?url";

let loaded: Promise<void> | null = null;

export function loadMusicFont(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    try {
      const face = new FontFace("Bravura", `url(${bravuraUrl})`);
      const registered = await face.load();
      document.fonts.add(registered);
      await document.fonts.ready;
      VexFlow.setFonts("Bravura");
    } catch {
      // Fall back gracefully if FontFace loading fails in restricted contexts.
    }
  })();
  return loaded;
}
