import UPNG from "upng-js";
import { decodeAll } from "./rgba.mjs";

/**
 * APNG —— 透明动效图标的最佳选择：完整 8bit alpha，Chrome/Safari/Firefox/Edge 全支持，
 * 且 <img src="x.png"> 直接就能用，不支持 APNG 的老环境会退化成显示第一帧。
 *
 * colors=0 走无损 32 位；给个 2..256 之间的值则做调色板量化，体积能小很多。
 */
export async function encodeApng({ frames, fps, colors = 0, loops = 0 }) {
  const decoded = decodeAll(frames);
  const { width, height } = decoded[0];
  const delay = Math.round(1000 / fps);
  const delays = decoded.map(() => delay);
  const buffers = decoded.map((d) => d.data.buffer);

  const out = UPNG.encode(buffers, width, height, colors, delays);
  const buf = Buffer.from(out);

  // UPNG 固定写 num_plays=0（无限循环）。需要有限次数时改写 acTL 里的那 4 个字节。
  return loops === 0 ? buf : patchApngLoops(buf, loops);
}

function patchApngLoops(buf, loops) {
  // acTL chunk: [长度4][类型4 "acTL"][num_frames4][num_plays4][crc4]
  const idx = buf.indexOf("acTL", 0, "latin1");
  if (idx < 0) return buf;
  const numPlaysOffset = idx + 4 + 4;
  buf.writeUInt32BE(loops, numPlaysOffset);
  // 重算这个 chunk 的 CRC（覆盖类型+数据共 12 字节）
  const crc = crc32(buf.subarray(idx, idx + 4 + 8));
  buf.writeUInt32BE(crc >>> 0, idx + 4 + 8);
  return buf;
}

let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
