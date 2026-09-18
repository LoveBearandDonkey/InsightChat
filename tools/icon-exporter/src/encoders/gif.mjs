// gifenc 只发了 CJS 且没声明 exports 字段，Node 探测不到具名导出，只能整体引入
import gifenc from "gifenc";
import { decodeAll, binarizeAlpha, flattenOnto } from "./rgba.mjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * GIF —— 兼容性最好，但有两个硬限制：
 *   1. 每帧最多 256 色
 *   2. 透明度只有 1 bit（要么全透明要么全不透明，没有半透明）
 * 所以带柔和阴影/发光/抗锯齿边缘的图标，导 GIF 边缘一定会有锯齿。
 * 这种情况建议优先用 APNG 或 WebP。
 *
 * 关于调色板：不用 gifenc 的 rgba4444 格式（每通道只有 4bit，渐变会断层），
 * 而是只拿不透明像素按 rgb565 量化，再手动追加一个色号专门当透明色。
 * 这样 255 个色号全用在可见颜色上，渐变质量明显更好。
 */
export async function encodeGif({
  frames, fps, loops = 0,
  colors = 255,          // 可见颜色数；开透明时上限 255（要留 1 个给透明）
  alphaThreshold = 128,  // alpha 低于此值判为全透明
  palette: paletteMode = "global",
  matte = null,          // 传 [r,g,b] 则放弃透明，直接合成到该底色上
}) {
  const decoded = decodeAll(frames);
  const { width, height } = decoded[0];
  const pixelCount = width * height;
  const delay = Math.round(1000 / fps);
  const useAlpha = matte === null;

  const prepared = decoded.map((d) =>
    useAlpha ? binarizeAlpha(d.data, alphaThreshold) : flattenOnto(d.data, matte)
  );

  const maxColors = Math.max(2, Math.min(useAlpha ? 255 : 256, colors));
  const buildPalette = (rgbaFrames) => {
    const samples = sampleVisible(rgbaFrames, pixelCount, useAlpha);
    if (samples.length === 0) return [[0, 0, 0]]; // 整帧全透明的兜底
    return quantize(samples, maxColors, { format: "rgb565" });
  };

  const globalPalette = paletteMode === "global" ? buildPalette(prepared) : null;

  const gif = GIFEncoder();
  for (let i = 0; i < prepared.length; i++) {
    const rgba = prepared[i];
    const basePalette = globalPalette ?? buildPalette([rgba]);
    const index = applyPalette(rgba, basePalette, "rgb565");

    let palette = basePalette;
    let transparentIndex = 0;

    if (useAlpha) {
      // 把透明色追加在末尾，然后把所有全透明像素的色号改指过去。
      // 先 applyPalette 再改写，可以避免这个"黑色"色号在最近邻匹配时把深色像素吸走。
      transparentIndex = basePalette.length;
      palette = [...basePalette, [0, 0, 0]];
      for (let p = 0; p < pixelCount; p++) {
        if (rgba[p * 4 + 3] === 0) index[p] = transparentIndex;
      }
    }

    // 全局调色板模式下只在首帧写色表（gifenc 会把它当全局色表 GCT），
    // 后续帧不传 palette 就直接复用，省掉每帧约 768 字节的局部色表
    const isFirst = i === 0;
    const writePalette = isFirst || paletteMode !== "global";

    gif.writeFrame(index, width, height, {
      palette: writePalette ? palette : undefined,
      delay,
      transparent: useAlpha,
      transparentIndex,
      dispose: useAlpha ? 2 : -1, // 2 = 每帧绘制前清回背景，避免透明区域残留上一帧
      repeat: isFirst ? loops : 0,
    });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

/**
 * 量化取样：只喂"看得见"的像素。
 * 全透明像素的 RGB 已经被清成黑色，如果一起参与量化会白白吃掉色号。
 * 长动画全量取样太吃内存，所以按固定步长抽。
 */
function sampleVisible(framesRgba, pixelCount, useAlpha) {
  const MAX_SAMPLES = 300_000;
  const perFrame = Math.max(1, Math.floor(MAX_SAMPLES / framesRgba.length));
  const stride = Math.max(1, Math.ceil(pixelCount / perFrame));

  const out = [];
  for (const f of framesRgba) {
    for (let p = 0; p < pixelCount; p += stride) {
      const o = p * 4;
      if (useAlpha && f[o + 3] === 0) continue;
      out.push(f[o], f[o + 1], f[o + 2], 255);
    }
  }
  return new Uint8Array(out);
}
