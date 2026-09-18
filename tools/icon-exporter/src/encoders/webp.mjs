import webpmux from "node-webpmux";
import { decodeAll } from "./rgba.mjs";

const { Image } = webpmux;

/**
 * 动画 WebP —— 体积/画质的平衡点：完整 8bit alpha，体积通常只有 APNG 的 1/3～1/2。
 * 缺点是老浏览器（IE、iOS 13 以下）不支持，需要配 APNG 或静态图兜底。
 *
 * lossless=true 走无损（图标类扁平色块通常无损反而更小）；
 * lossless=false 时 quality 生效，适合有渐变/发光的图标。
 */
export async function encodeWebp({
  frames, fps, loops = 0,
  lossless = true,
  quality = 90,
  method = 4,
}) {
  await Image.initLib();

  const decoded = decodeAll(frames);
  const { width, height } = decoded[0];
  const delay = Math.round(1000 / fps);

  const anmf = [];
  for (const d of decoded) {
    const img = await Image.getEmptyImage();
    await img.setImageData(Buffer.from(d.data), {
      width,
      height,
      lossless: lossless ? 1 : 0,
      quality,
      method,
      // 关键：不加 exact，libwebp 会为了压缩率改写全透明像素的 RGB，
      // 半透明边缘附近会出现脏色晕
      exact: true,
    });
    anmf.push(
      await Image.generateFrame({
        img,
        delay,
        // blend=false + dispose=true：每帧独立绘制并在绘制前清空画布，
        // 这是带透明通道动画唯一安全的组合，否则透明区会叠出残影
        blend: false,
        dispose: true,
      })
    );
  }

  return await Image.save(null, {
    frames: anmf,
    width,
    height,
    loops,
    bgColor: [0, 0, 0, 0],
  });
}
