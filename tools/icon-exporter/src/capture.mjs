import http from "node:http";
import puppeteer from "puppeteer-core";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChrome } from "./resolve-chrome.mjs";
import { buildHarnessHtml } from "./harness/page.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * 起一个极简静态服务器。
 * 用 http:// 而不是 file:// 或 setContent，是为了让组件里的字体、图片、
 * 以及 WebGL 的 texture 加载不受 file:// 的跨域限制。
 */
async function serve(html, publicDir) {
  const server = http.createServer(async (req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    if (publicDir) {
      // 归一化后校验前缀，防止 ../ 逃逸出 publicDir
      const target = path.resolve(publicDir, "." + url);
      if (target.startsWith(path.resolve(publicDir))) {
        try {
          const body = await readFile(target);
          res.writeHead(200);
          return res.end(body);
        } catch { /* 落到 404 */ }
      }
    }
    res.writeHead(404);
    res.end("not found");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, port: server.address().port };
}

/**
 * 逐帧抽取 PNG。
 * 返回 { frames: Buffer[], width, height } —— width/height 已包含 scale 放大。
 */
export async function captureFrames(opts) {
  const {
    js, css, width, height, fps, totalFrames,
    scale = 1, subframes = 1, background = "transparent",
    warmupMs = 0, chromePath, publicDir, gpu = false, verbose = false,
    onProgress,
  } = opts;

  const executablePath = resolveChrome(chromePath);
  const clockSource = await readFile(path.join(HERE, "harness", "clock.js"), "utf8");
  const html = buildHarnessHtml({ width, height, js, css, background });
  const { server, port } = await serve(html, publicDir);

  const args = [
    "--hide-scrollbars",
    "--mute-audio",
    "--force-color-profile=srgb",
    "--disable-lcd-text",
    "--font-render-hinting=none",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ];
  if (gpu) {
    args.push("--use-gl=angle", "--ignore-gpu-blocklist", "--enable-gpu-rasterization");
  } else {
    // Chrome 130+ 用 SwiftShader 软件渲染 WebGL 必须显式开这个开关
    args.push("--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader");
  }

  const browser = await puppeteer.launch({ executablePath, headless: true, args });
  const frames = [];
  let page;

  try {
    page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: scale });

    if (verbose) {
      page.on("console", (m) => console.log("  [page]", m.text()));
    }
    page.on("pageerror", (e) => console.error("  [page error]", e.message));

    // 必须在页面脚本之前注入时钟
    await page.evaluateOnNewDocument(clockSource);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0", timeout: 60_000 });

    const err = await page.evaluate(() => window.__iconError);
    if (err) throw new Error("组件在页面中抛错:\n" + err);

    // 等挂载完成（React root.render / vanilla mount 的返回值）
    await page.evaluate(async () => {
      if (window.__iconMounted) await window.__iconMounted;
    });
    await page.evaluate(() => window.__iconClock.settle());

    // 有些图标有一段"入场"，warmup 让它先跑掉再开始录
    if (warmupMs > 0) {
      await page.evaluate((ms, sub) => window.__iconClock.advanceTo(ms, sub), warmupMs, Math.max(4, subframes));
    }

    const frameDurationMs = 1000 / fps;
    const baseMs = warmupMs;

    for (let i = 0; i < totalFrames; i++) {
      if (i > 0) {
        const target = baseMs + i * frameDurationMs;
        await page.evaluate((t, sub) => window.__iconClock.advanceTo(t, sub), target, subframes);
      }
      const buf = await page.screenshot({
        type: "png",
        omitBackground: background === "transparent",
        captureBeyondViewport: false,
        optimizeForSpeed: true,
      });
      frames.push(Buffer.from(buf));
      onProgress?.(i + 1, totalFrames);
    }

    const runtimeError = await page.evaluate(() => window.__iconError);
    if (runtimeError) console.warn("  [warn] 抽帧过程中页面报过错:\n" + runtimeError);

    return { frames, width: Math.round(width * scale), height: Math.round(height * scale) };
  } finally {
    await page?.close().catch(() => {});
    await browser.close().catch(() => {});
    server.close();
  }
}
