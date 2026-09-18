/**
 * 把 public/ 下的录屏重编码成「渲染友好」的版本，落到 public/render/。
 *
 * 为什么要这一步：OBS 出来的 mp4 是**长 GOP + B 帧**——A段 32s 里只有 8 个关键帧
 * （每 4.17s 一个），帧间隔里全是负值（B 帧重排）。
 * `<OffthreadVideo>` 要取任意一帧就得从上一个关键帧往前解码两百多帧，
 * 渲染时会直接报 `No frame found at position ...`，Studio 里拖时间轴也卡。
 *
 * 重编码只改**编码方式**，不改分辨率、帧率、色彩：
 *   -g 30 -keyint_min 30 -sc_threshold 0   每 0.5s 一个关键帧，seek 就近有据
 *   -bf 0                                   不要 B 帧，解码顺序 = 显示顺序
 *   -crf 18                                 视觉无损，反正只是中间件
 *
 * 原始素材一个都不动，随时可以重跑。
 *   node tools/reencode-for-render.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const FILES = [
  "A段.mp4",
  "C段.mp4",
  "D+E段.mp4",
  "F段.mp4",
  "G段.mp4",
  "H段-依次悬浮引导卡.mp4",
];

const OUT_DIR = path.join("public", "render");
mkdirSync(OUT_DIR, { recursive: true });

const mb = (p) => (statSync(p).size / 1048576).toFixed(1);

for (const name of FILES) {
  const src = path.join("public", name);
  const dst = path.join(OUT_DIR, name);
  if (!existsSync(src)) {
    console.log(`跳过（找不到） ${src}`);
    continue;
  }
  process.stdout.write(`转码 ${name} (${mb(src)} MB) … `);
  const t0 = Date.now();
  execFileSync(
    "npx",
    [
      "remotion", "ffmpeg",
      "-i", src,
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "veryfast",
      "-g", "30",
      "-keyint_min", "30",
      "-sc_threshold", "0",
      "-bf", "0",
      "-pix_fmt", "yuv420p",
      "-an",
      "-movflags", "+faststart",
      "-y", dst,
    ],
    { stdio: ["ignore", "ignore", "ignore"], shell: true },
  );
  console.log(`→ ${mb(dst)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log("\n完成。src/components/RecordingScreen.tsx 里的 RENDER_DIR 指向的就是这里。");
