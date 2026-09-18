#!/usr/bin/env node
/**
 * 环境自检 + 冒烟测试。
 *
 * 在一台新机器上拿到这个文件夹后，第一件事就是跑 `npm run doctor`。
 * 它会依次检查：Node 版本 → 依赖完整性 → Chrome → 打包 → 抽帧 → 编码 → 产物质量 → 确定性。
 * 全绿才说明这台机器可以开始转换图标。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
let failed = false;

function record(name, ok, detail, fatal = true) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(22)} ${detail}`);
  if (!ok && fatal) failed = true;
  return ok;
}

console.log("\nicon-exporter 环境自检\n" + "─".repeat(52));

// ---------- 1. Node 版本 ----------
const major = Number(process.versions.node.split(".")[0]);
record(
  "Node 版本",
  major >= 18,
  `${process.version} ${major >= 18 ? "" : "（需要 >= 18）"}${os.platform()}/${os.arch()}`
);

// ---------- 2. 依赖完整性 ----------
const REQUIRED = ["esbuild-wasm", "gifenc", "upng-js", "node-webpmux", "puppeteer-core"];
const missing = [];
for (const dep of REQUIRED) {
  const pj = path.join(ROOT, "node_modules", dep, "package.json");
  if (!fs.existsSync(pj)) missing.push(dep);
}
record(
  "依赖完整性",
  missing.length === 0,
  missing.length === 0
    ? `${REQUIRED.length} 个包齐全`
    : `缺失: ${missing.join(", ")} —— 请在本目录执行 npm ci`
);

if (failed) {
  console.log("\n基础检查未通过，后续步骤已跳过。\n");
  process.exit(1);
}

// ---------- 3. Chrome ----------
const { resolveChrome } = await import("../src/resolve-chrome.mjs");
let chromePath = null;
try {
  chromePath = resolveChrome(null);
  record("Chrome", true, chromePath);
} catch (err) {
  record("Chrome", false, String(err.message).split("\n")[0]);
}

if (failed) {
  console.log(
    "\n没找到浏览器。请安装 Google Chrome 或 Microsoft Edge，" +
    "或设置环境变量 CHROME_PATH 指向可执行文件。\n"
  );
  process.exit(1);
}

// ---------- 4~7. 冒烟测试：原生 WebGL 图标，不依赖任何三方库 ----------
const { bundleEntry } = await import("../src/bundle.mjs");
const { captureFrames } = await import("../src/capture.mjs");
const { encodeApng } = await import("../src/encoders/apng.mjs");
const { encodeGif } = await import("../src/encoders/gif.mjs");
const { encodeWebp } = await import("../src/encoders/webp.mjs");
const UPNG = (await import("upng-js")).default;

const ENTRY = path.join(ROOT, "examples", "webgl-raw.tsx");
const SIZE = 120;
const FPS = 10;
const FRAMES = 10;

async function runOnce() {
  const { js, css } = await bundleEntry({
    entry: ENTRY, framework: "auto", exportName: null, props: { size: SIZE },
  });
  const { frames } = await captureFrames({
    js, css, width: SIZE, height: SIZE, fps: FPS, totalFrames: FRAMES,
    scale: 1, subframes: 1, background: "transparent", warmupMs: 0,
    chromePath: null, publicDir: null, gpu: false, verbose: false,
  });
  return frames;
}

let frames;
try {
  const t0 = Date.now();
  frames = await runOnce();
  record("打包 + 抽帧", frames.length === FRAMES, `${frames.length} 帧 / ${((Date.now() - t0) / 1000).toFixed(1)}s（含 WebGL 渲染）`);
} catch (err) {
  record("打包 + 抽帧", false, String(err.message).split("\n")[0]);
  console.log("\n冒烟测试失败，无法继续。\n");
  process.exit(1);
}

// ---------- 产物质量：透明通道 + 动画是否真的在动 ----------
const toRgba = (buf) => {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const img = UPNG.decode(ab);
  return new Uint8Array(UPNG.toRGBA8(img)[0]);
};
const first = toRgba(frames[0]);
const mid = toRgba(frames[Math.floor(FRAMES / 2)]);

let transparent = 0, opaque = 0;
for (let i = 3; i < first.length; i += 4) {
  if (first[i] === 0) transparent++;
  else if (first[i] === 255) opaque++;
}
const px = first.length / 4;
const tPct = (transparent / px) * 100;
const oPct = (opaque / px) * 100;

record(
  "透明通道",
  transparent > px * 0.1 && opaque > px * 0.02,
  `全透明 ${tPct.toFixed(0)}% / 不透明 ${oPct.toFixed(0)}%` +
    (transparent <= px * 0.1 ? "  ← 几乎没有透明像素，alpha 可能没生效" : "") +
    (opaque <= px * 0.02 ? "  ← 几乎没有内容，WebGL 可能没画出东西" : "")
);

let diff = 0;
for (let i = 0; i < first.length; i += 4) {
  if (Math.abs(first[i] - mid[i]) > 8 || Math.abs(first[i + 3] - mid[i + 3]) > 8) diff++;
}
const dPct = (diff / px) * 100;
record("动画是否在动", dPct > 1, `首帧与中间帧差异 ${dPct.toFixed(1)}%` + (dPct <= 1 ? "  ← 几乎没变化，动画可能是静止的" : ""));

// ---------- 三个编码器 ----------
for (const [label, fn, check] of [
  ["APNG 编码", () => encodeApng({ frames, fps: FPS, colors: 0, loops: 0 }), (b) => b.subarray(1, 4).toString("latin1") === "PNG" && b.includes(Buffer.from("acTL"))],
  ["WebP 编码", () => encodeWebp({ frames, fps: FPS, lossless: true, quality: 90, method: 4, loops: 0 }), (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.includes(Buffer.from("ANMF"))],
  ["GIF 编码", () => encodeGif({ frames, fps: FPS, colors: 255, alphaThreshold: 128, palette: "global", matte: null, loops: 0 }), (b) => b.subarray(0, 6).toString("latin1") === "GIF89a"],
]) {
  try {
    const buf = await fn();
    record(label, check(buf), `${(buf.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    record(label, false, String(err.message).split("\n")[0]);
  }
}

// ---------- 确定性 ----------
try {
  const frames2 = await runOnce();
  const h = (fs_) => crypto.createHash("sha256").update(Buffer.concat(fs_)).digest("hex").slice(0, 12);
  const a = h(frames), b = h(frames2);
  record("确定性", a === b, a === b ? `两次运行完全一致 (${a})` : `两次运行不一致 (${a} vs ${b})`, false);
} catch (err) {
  record("确定性", false, String(err.message).split("\n")[0], false);
}

console.log("─".repeat(52));
if (failed) {
  console.log("\n自检未通过。上面标 ✗ 的项需要先解决。\n");
  process.exit(1);
}
console.log("\n✓ 自检通过，这台机器可以开始转换图标了。");
console.log("  下一步看 README.md 的「制作流程」一节。\n");
