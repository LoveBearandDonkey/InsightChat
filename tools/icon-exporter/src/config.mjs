import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const DEFAULTS = {
  entry: null,
  out: "out/icon",
  formats: ["apng"],
  width: 256,
  height: 256,
  fps: 30,
  duration: 2,          // 秒；和 frames 二选一
  frames: null,         // 显式帧数，优先于 duration
  scale: 1,             // 2 = 导 2x 图
  subframes: 1,         // 每个输出帧之间跑几次 rAF
  warmup: 0,            // 开录前先空跑的秒数
  background: "transparent",
  framework: "auto",    // auto | react | vanilla
  export: null,         // 指定具名导出
  props: {},
  chrome: null,
  publicDir: null,
  gpu: false,
  verbose: false,
  gif: { colors: 255, alphaThreshold: 128, palette: "global", matte: null, loops: 0 },
  webp: { lossless: true, quality: 90, method: 4, loops: 0 },
  apng: { colors: 0, loops: 0 },
};

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === undefined) continue;
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

/** 配置优先级：默认值 < 配置文件 < 命令行 */
export async function loadConfig({ configPath, cliOptions, cwd = process.cwd() }) {
  let fileConfig = {};
  let resolvedConfigPath = null;

  const candidates = configPath
    ? [path.resolve(cwd, configPath)]
    : ["icon-export.config.mjs", "icon-export.config.js"].map((f) => path.resolve(cwd, f));

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const mod = await import(pathToFileURL(c).href);
      fileConfig = mod.default ?? mod.config ?? {};
      resolvedConfigPath = c;
      break;
    }
  }
  if (configPath && !resolvedConfigPath) {
    throw new Error(`找不到配置文件: ${path.resolve(cwd, configPath)}`);
  }

  const merged = deepMerge(deepMerge(DEFAULTS, fileConfig), cliOptions);

  if (!merged.entry) {
    throw new Error("必须指定入口文件：icon-export <entry.tsx> 或在配置文件里写 entry");
  }
  merged.entry = path.resolve(resolvedConfigPath ? path.dirname(resolvedConfigPath) : cwd, merged.entry);
  if (!fs.existsSync(merged.entry)) {
    throw new Error(`入口文件不存在: ${merged.entry}`);
  }
  if (merged.publicDir) {
    merged.publicDir = path.resolve(cwd, merged.publicDir);
  }

  merged.totalFrames = merged.frames ?? Math.max(1, Math.round(merged.duration * merged.fps));
  merged.configPath = resolvedConfigPath;
  return merged;
}
