#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config.mjs";
import { bundleEntry } from "../src/bundle.mjs";
import { captureFrames } from "../src/capture.mjs";
import { encodeGif } from "../src/encoders/gif.mjs";
import { encodeWebp } from "../src/encoders/webp.mjs";
import { encodeApng } from "../src/encoders/apng.mjs";
import { writePngSequence } from "../src/encoders/png-seq.mjs";

const HELP = `
icon-export —— 把组件代码渲染成透明底的动效图标

用法:
  icon-export <入口文件> [选项]
  icon-export --config icon-export.config.mjs

常用选项:
  -o, --out <前缀>        输出路径前缀，默认 out/icon
  -f, --format <列表>     apng,webp,gif,png  （逗号分隔，默认 apng）
  -s, --size <W[xH]>      画布尺寸，默认 256x256
      --fps <n>           帧率，默认 30
  -d, --duration <秒>     时长，默认 2
      --frames <n>        直接指定帧数（优先于 duration）
      --scale <n>         导出倍率，2 = 2x 图
      --warmup <秒>       开录前先空跑一段（跳过入场动画）
      --subframes <n>     每输出帧之间跑几次 rAF，物理动画调大有用
      --background <css>  默认 transparent；给了颜色就是不透明导出
      --framework <名>    auto | react | vanilla
      --export <名字>     指定具名导出（默认取 default）
      --props <json>      传给组件的 props
      --public <目录>     静态资源目录（组件里 fetch 的贴图/字体放这）
      --chrome <路径>     指定 Chrome，可用环境变量 CHROME_PATH
      --gpu               用真实 GPU 而非 SwiftShader（默认软件渲染，结果更稳定）
  -v, --verbose           打印页面 console
  -h, --help

GIF 专属:
      --gif-colors <n>        调色板色数，默认 255
      --gif-alpha <0-255>     透明判定阈值，默认 128
      --gif-palette <模式>    global | per-frame，默认 global
      --gif-matte <#rrggbb>   放弃透明，直接合成到该底色

WebP 专属:
      --webp-lossy            改用有损压缩
      --webp-quality <0-100>  有损质量，默认 90

APNG 专属:
      --apng-colors <n>       0=无损32位（默认），2-256 走调色板量化压体积
`;

function parseArgs(argv) {
  const cli = {};
  let entry = null;
  const next = () => argv[++i];
  let i = 0;

  for (; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("-")) { entry ??= a; continue; }
    switch (a) {
      case "-h": case "--help": return { help: true };
      case "-v": case "--verbose": cli.verbose = true; break;
      case "-o": case "--out": cli.out = next(); break;
      case "-f": case "--format": cli.formats = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "-s": case "--size": {
        const [w, h] = next().split("x");
        cli.width = Number(w); cli.height = Number(h ?? w); break;
      }
      case "--fps": cli.fps = Number(next()); break;
      case "-d": case "--duration": cli.duration = Number(next()); break;
      case "--frames": cli.frames = Number(next()); break;
      case "--scale": cli.scale = Number(next()); break;
      case "--warmup": cli.warmup = Number(next()); break;
      case "--subframes": cli.subframes = Number(next()); break;
      case "--background": cli.background = next(); break;
      case "--framework": cli.framework = next(); break;
      case "--export": cli.export = next(); break;
      case "--props": cli.props = JSON.parse(next()); break;
      case "--public": cli.publicDir = next(); break;
      case "--chrome": cli.chrome = next(); break;
      case "--gpu": cli.gpu = true; break;
      case "--config": cli.configPath = next(); break;
      case "--gif-colors": (cli.gif ??= {}).colors = Number(next()); break;
      case "--gif-alpha": (cli.gif ??= {}).alphaThreshold = Number(next()); break;
      case "--gif-palette": (cli.gif ??= {}).palette = next(); break;
      case "--gif-matte": (cli.gif ??= {}).matte = hexToRgb(next()); break;
      case "--webp-lossy": (cli.webp ??= {}).lossless = false; break;
      case "--webp-quality": (cli.webp ??= {}).quality = Number(next()); break;
      case "--apng-colors": (cli.apng ??= {}).colors = Number(next()); break;
      default: throw new Error(`未知选项: ${a}（用 --help 看支持的选项）`);
    }
  }
  if (entry) cli.entry = entry;
  return { cli };
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`颜色格式应为 #rrggbb，收到: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`);

async function main() {
  const { help, cli } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(HELP);
    process.exit(0);
  }

  // 不带参数直接跑是合法的 —— 当前目录有 icon-export.config.mjs 就按它来。
  // 只有连配置文件都没有（loadConfig 抱怨缺 entry）时才退回打印帮助。
  const { configPath, ...cliOptions } = cli;
  let cfg;
  try {
    cfg = await loadConfig({ configPath, cliOptions });
  } catch (err) {
    if (process.argv.length <= 2 && String(err.message).includes("必须指定入口文件")) {
      console.log(HELP);
      process.exit(1);
    }
    throw err;
  }

  console.log(`\n▶ 入口     ${path.relative(process.cwd(), cfg.entry)}`);
  console.log(`  画布     ${cfg.width}×${cfg.height}${cfg.scale !== 1 ? ` @${cfg.scale}x` : ""}`);
  console.log(`  时长     ${cfg.totalFrames} 帧 / ${cfg.fps}fps = ${(cfg.totalFrames / cfg.fps).toFixed(2)}s`);
  console.log(`  输出     ${cfg.formats.join(", ")}\n`);

  process.stdout.write("  打包组件… ");
  const { js, css, mode, hasReact } = await bundleEntry({
    entry: cfg.entry,
    framework: cfg.framework,
    exportName: cfg.export,
    props: cfg.props,
  });
  const modeLabel = mode === "auto" ? (hasReact ? "自动识别 / React 可用" : "自动识别 / 仅原生 mount") : mode;
  console.log(`完成（${modeLabel}，${fmtSize(js.length)}）`);

  // GIF 的帧延迟单位是 10ms，除不尽的帧率会被四舍五入，实际播放速度对不上
  if (cfg.formats.includes("gif")) {
    const ms = 1000 / cfg.fps;
    if (Math.abs(ms - Math.round(ms / 10) * 10) > 0.5) {
      const actual = (1000 / (Math.round(ms / 10) * 10)).toFixed(1);
      console.warn(`  [提醒] GIF 帧延迟只能是 10ms 的整数倍，${cfg.fps}fps 会被取整成约 ${actual}fps。`);
      console.warn("         想要精确速度，GIF 请用 50 / 25 / 20 / 10 fps。");
    }
    if (cfg.fps > 50) {
      console.warn("  [提醒] 多数浏览器会把小于 20ms 的 GIF 帧延迟强制拉到 100ms，超过 50fps 的 GIF 会明显变慢。");
    }
  }

  const { frames, width, height } = await captureFrames({
    js, css,
    width: cfg.width, height: cfg.height, fps: cfg.fps,
    totalFrames: cfg.totalFrames, scale: cfg.scale, subframes: cfg.subframes,
    background: cfg.background, warmupMs: cfg.warmup * 1000,
    chromePath: cfg.chrome, publicDir: cfg.publicDir, gpu: cfg.gpu, verbose: cfg.verbose,
    onProgress: (n, total) => {
      process.stdout.write(`\r  抽帧…     ${n}/${total}`);
      if (n === total) process.stdout.write("\n");
    },
  });

  const outBase = path.resolve(cfg.out);
  await fs.mkdir(path.dirname(outBase), { recursive: true });
  const results = [];

  for (const format of cfg.formats) {
    process.stdout.write(`  编码 ${format}…`);
    const started = Date.now();
    let outPath;

    if (format === "png") {
      outPath = outBase + "-frames";
      const written = await writePngSequence({ frames, outDir: outPath });
      results.push({ format, outPath, size: written.length, isDir: true });
    } else {
      let buf;
      if (format === "gif") buf = await encodeGif({ frames, fps: cfg.fps, ...cfg.gif });
      else if (format === "webp") buf = await encodeWebp({ frames, fps: cfg.fps, ...cfg.webp });
      else if (format === "apng") buf = await encodeApng({ frames, fps: cfg.fps, ...cfg.apng });
      else throw new Error(`不支持的格式: ${format}（支持 apng / webp / gif / png）`);

      outPath = `${outBase}.${format === "apng" ? "png" : format}`;
      await fs.writeFile(outPath, buf);
      results.push({ format, outPath, size: buf.length });
    }
    process.stdout.write(` ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  }

  console.log("\n✓ 导出完成");
  for (const r of results) {
    const rel = path.relative(process.cwd(), r.outPath);
    console.log(`  ${r.format.padEnd(5)} ${rel}  ${r.isDir ? `${r.size} 个文件` : fmtSize(r.size)}`);
  }
  console.log(`  尺寸  ${width}×${height}\n`);
}

main().catch((err) => {
  console.error("\n✗ " + (err?.message ?? err));
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
