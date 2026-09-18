import fs from "node:fs/promises";
import path from "node:path";

/** PNG 序列 —— 交给设计同学再加工，或者喂给 ffmpeg / AE 时用 */
export async function writePngSequence({ frames, outDir }) {
  await fs.mkdir(outDir, { recursive: true });
  const pad = String(frames.length - 1).length;
  const written = [];
  for (let i = 0; i < frames.length; i++) {
    const p = path.join(outDir, `frame-${String(i).padStart(pad, "0")}.png`);
    await fs.writeFile(p, frames[i]);
    written.push(p);
  }
  return written;
}
