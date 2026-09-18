/**
 * 检查一段录屏的分辨率 / 帧率，确认 OBS 没有偷偷降采样。
 * 用法：  node tools/check-recording.mjs "C:\Users\你\Videos\test.mkv"
 *
 * 走 Remotion 自带的 @remotion/media-parser，不需要另外装 ffmpeg。
 */
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";

const file = process.argv[2];
if (!file) {
  console.error("用法: node tools/check-recording.mjs <录屏文件路径>");
  process.exit(1);
}

const TARGET_W = 2880;
const TARGET_FPS = 60;

const { dimensions, fps, durationInSeconds, container } = await parseMedia({
  src: file,
  acknowledgeRemotionLicense: true,
  reader: nodeReader,
  fields: {
    dimensions: true,
    fps: true,
    durationInSeconds: true,
    container: true,
  },
});

// 音频文件（BGM）没有画面，走另一条分支，别拿录屏的标准去判它
if (!dimensions?.width) {
  console.log("");
  console.log(`  文件      ${file}`);
  console.log(`  容器      ${container}（音频）`);
  console.log(`  时长      ${durationInSeconds?.toFixed(2) ?? "?"} s`);
  const target = 48;
  const diff = (durationInSeconds ?? 0) - target;
  console.log("");
  console.log(
    Math.abs(diff) < 0.05
      ? `  ✅ 正好 ${target}s，和 TOTAL_FRAMES 对得上`
      : `  ⚠️ 和全片 ${target}s 差 ${diff.toFixed(2)}s`,
  );
  console.log("");
  process.exit(0);
}

const w = dimensions?.width ?? 0;
const h = dimensions?.height ?? 0;
const zoom = w / 1920;

console.log("");
console.log(`  文件      ${file}`);
console.log(`  容器      ${container}`);
console.log(`  分辨率    ${w} × ${h}`);
console.log(`  帧率      ${fps ?? "未知"} fps`);
console.log(`  时长      ${durationInSeconds?.toFixed(2) ?? "?"} s`);
console.log(`  可推近    ${zoom.toFixed(2)}x   （成片 1920 宽，源宽 ÷ 1920）`);
console.log("");

const problems = [];
if (w < TARGET_W) {
  problems.push(
    `分辨率只有 ${w} 宽，不是 ${TARGET_W} —— OBS「设置 → 视频 → 输出(缩放)分辨率」被降采样了`,
  );
}
if (fps && Math.round(fps) < TARGET_FPS) {
  problems.push(`帧率只有 ${Math.round(fps)}，不是 ${TARGET_FPS} —— 改「常用 FPS 值」`);
}

if (problems.length === 0) {
  console.log("  ✅ 合格，可以正式开录");
} else {
  console.log("  ❌ 有问题：");
  for (const p of problems) console.log(`     · ${p}`);
}
console.log("");
