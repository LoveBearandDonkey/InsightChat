import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * 找一个能用的 Chrome/Edge。
 * 优先级：显式指定 > 环境变量 > puppeteer 缓存 > 系统安装
 * 这么做是为了避免在公司内网里下载 150MB 的 Chromium。
 */
export function resolveChrome(explicit) {
  const tried = [];
  const check = (p) => {
    if (!p) return null;
    tried.push(p);
    try {
      return fs.statSync(p).isFile() ? p : null;
    } catch {
      return null;
    }
  };

  const found = check(explicit) || check(process.env.CHROME_PATH) || check(process.env.PUPPETEER_EXECUTABLE_PATH);
  if (found) return found;

  const home = os.homedir();
  const candidates = [];

  if (process.platform === "win32") {
    const roots = [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application"),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application"),
      process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application"),
      process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application"),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft/Edge/Application"),
    ].filter(Boolean);
    for (const root of roots) {
      candidates.push(path.join(root, "chrome.exe"), path.join(root, "msedge.exe"));
      // Chrome 会把真正的 exe 放在版本号子目录里
      try {
        for (const dir of fs.readdirSync(root)) {
          if (/^\d+\./.test(dir)) {
            candidates.push(path.join(root, dir, "chrome.exe"), path.join(root, dir, "msedge.exe"));
          }
        }
      } catch { /* 目录不存在，跳过 */ }
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium", "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge", "/snap/bin/chromium",
    );
  }

  // puppeteer 自己下载的缓存
  const ptrCache = path.join(home, ".cache", "puppeteer");
  try {
    for (const product of fs.readdirSync(ptrCache)) {
      const pDir = path.join(ptrCache, product);
      for (const rev of fs.readdirSync(pDir)) {
        candidates.push(
          path.join(pDir, rev, "chrome-win64", "chrome.exe"),
          path.join(pDir, rev, "chrome-mac-x64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
          path.join(pDir, rev, "chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
          path.join(pDir, rev, "chrome-linux64", "chrome"),
        );
      }
    }
  } catch { /* 没有缓存目录，跳过 */ }

  for (const c of candidates) {
    const hit = check(c);
    if (hit) return hit;
  }

  throw new Error(
    "没找到可用的 Chrome。请用 --chrome <路径> 指定，或设置环境变量 CHROME_PATH。\n" +
    "已尝试的位置:\n" + tried.slice(0, 12).map((t) => "  " + t).join("\n")
  );
}
