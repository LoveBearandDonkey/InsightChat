import UPNG from "upng-js";

/** 把 puppeteer 截出来的 PNG Buffer 解成 RGBA 原始像素 */
export function pngToRgba(buf) {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const img = UPNG.decode(ab);
  const rgba = UPNG.toRGBA8(img)[0];
  return { data: new Uint8Array(rgba), width: img.width, height: img.height };
}

export function decodeAll(frames) {
  return frames.map((f) => pngToRgba(f));
}

/**
 * 对 alpha 做二值化。GIF 只有 1 bit 透明度，半透明像素必须先决定去留。
 * 同时把被判为透明的像素 RGB 清零，避免调色板里混进"看不见但占色号"的颜色。
 */
export function binarizeAlpha(rgba, threshold) {
  const out = new Uint8Array(rgba);
  for (let i = 3; i < out.length; i += 4) {
    if (out[i] < threshold) {
      out[i - 3] = 0; out[i - 2] = 0; out[i - 1] = 0; out[i] = 0;
    } else {
      out[i] = 255;
    }
  }
  return out;
}

/**
 * 把透明像素的 RGB 换成指定底色再合成，用于需要"假透明"的场景
 * （比如目标平台不支持 alpha，但你知道它会放在白底上）。
 */
export function flattenOnto(rgba, [r, g, b]) {
  const out = new Uint8Array(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3] / 255;
    out[i] = Math.round(out[i] * a + r * (1 - a));
    out[i + 1] = Math.round(out[i + 1] * a + g * (1 - a));
    out[i + 2] = Math.round(out[i + 2] * a + b * (1 - a));
    out[i + 3] = 255;
  }
  return out;
}
