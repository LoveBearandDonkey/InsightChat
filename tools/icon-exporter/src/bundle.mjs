import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs";
// 用 wasm 版而不是原生版 —— 原生 esbuild 每个平台一个二进制，
// 整个文件夹就没法拷到别的机器直接用了。wasm 版慢一点（约 1 秒），但完全跨平台。
import * as esbuild from "esbuild-wasm";

/** 判断某个包能否从用户组件所在目录解析出来 */
export function canResolveFrom(dir, pkg) {
  try {
    createRequire(path.join(dir, "__resolve__.js")).resolve(pkg);
    return true;
  } catch {
    return false;
  }
}

/**
 * 生成引导代码。
 *
 * 挂载方式的判定放在运行时而不是构建时 —— 因为"能不能解析到 react-dom"
 * 只说明依赖装没装，说明不了这个入口文件到底导出的是 React 组件还是 mount 函数。
 * 约定：导出名为 mount 的函数走原生挂载，其余一律当 React 组件。
 */
function makeBootstrap({ importPath, exportName, propsJson, mode, hasReact }) {
  const wantReact = mode !== "vanilla" && hasReact;

  return `
${wantReact ? 'import React from "react";\nimport { createRoot } from "react-dom/client";' : ""}
import * as mod from ${JSON.stringify(importPath)};

const props = ${propsJson};
const el = document.getElementById("icon-root");
const MODE = ${JSON.stringify(mode)};
const picked = ${exportName ? `mod[${JSON.stringify(exportName)}]` : "undefined"};
const exportNames = Object.keys(mod);

function fail(msg) {
  throw new Error("[icon-export] " + msg + " / 该模块的导出有: " + (exportNames.join(", ") || "(空)"));
}

// 该走原生 mount 还是 React？
let useVanilla;
if (MODE === "vanilla") useVanilla = true;
else if (MODE === "react") useVanilla = false;
else {
  // auto：显式指定了 --export mount 或模块导出了 mount 函数，就走原生
  useVanilla = ${exportName ? `typeof picked === "function" && ${JSON.stringify(exportName)} === "mount"` : 'typeof mod.mount === "function"'};
}

if (useVanilla) {
  const mount = picked ?? mod.mount ?? mod.default;
  if (typeof mount !== "function") {
    fail("原生模式需要入口导出 mount(element, props) 函数。");
  }
  window.__iconMounted = Promise.resolve(mount(el, props));
} else {
${
  wantReact
    ? `  const Comp = picked ?? mod.default ?? mod.Component ?? mod.Icon;
  if (!Comp) {
    fail("没找到可挂载的组件。请用 export default 导出，或用 --export <名字> 指定具名导出。");
  }
  const root = createRoot(el);
  root.render(React.createElement(Comp, props));
  // React 19 的 createRoot 是异步提交的，让出一轮微任务确保首帧内容已经在 DOM 里
  window.__iconMounted = new Promise((r) => queueMicrotask(r));`
    : `  fail("这个入口看起来是 React 组件，但从入口文件所在目录解析不到 react-dom。请在该项目里装好 react / react-dom，或改用 --framework vanilla 并导出 mount()。");`
}
}
`;
}

/**
 * 把用户入口打成一个 IIFE bundle。
 * 关键点：resolveDir 指向用户入口所在目录，依赖按 Node 规则逐级向上查找，
 * 所以工具本身不需要装 react / three / 你们的组件库。
 */
export async function bundleEntry({ entry, framework = "auto", exportName, props, minify = false, define = {}, alias = {} }) {
  const entryAbs = path.resolve(entry);
  const resolveDir = path.dirname(entryAbs);
  let hasReact = canResolveFrom(resolveDir, "react-dom/client");

  // auto 模式下先扫一眼源码：如果入口明摆着导出 mount，就别把 React 打进 bundle 了。
  // 只是省体积和构建时间，真正的挂载方式判断仍然在运行时做。
  if (framework === "auto" && hasReact && !exportName && exportsMount(entryAbs)) {
    hasReact = false;
  }

  if (framework === "react" && !hasReact) {
    throw new Error(
      `--framework react 需要能从 ${resolveDir} 解析到 react-dom，请先在该项目里安装 react 和 react-dom。`
    );
  }

  const contents = makeBootstrap({
    importPath: "./" + path.basename(entryAbs),
    exportName,
    propsJson: JSON.stringify(props ?? {}),
    mode: framework,
    hasReact,
  });

  const result = await esbuild.build({
    stdin: { contents, resolveDir, sourcefile: "icon-export-bootstrap.jsx", loader: "jsx" },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["chrome120"],
    minify,
    sourcemap: false,
    jsx: "automatic",
    logLevel: "silent",
    alias,
    define: { "process.env.NODE_ENV": '"production"', ...define },
    loader: {
      ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl",
      ".gif": "dataurl", ".webp": "dataurl", ".svg": "dataurl",
      ".woff": "dataurl", ".woff2": "dataurl", ".ttf": "dataurl",
      ".glb": "dataurl", ".gltf": "dataurl", ".hdr": "dataurl",
    },
    outdir: "out",
  });

  const js = result.outputFiles.filter((f) => f.path.endsWith(".js")).map((f) => f.text).join("\n");
  const css = result.outputFiles.filter((f) => f.path.endsWith(".css")).map((f) => f.text).join("\n");

  return { js, css, mode: framework, hasReact };
}

/** 粗扫源码判断入口是否导出了 mount。只用于决定要不要把 React 打进包，判错也不影响正确性。 */
function exportsMount(entryAbs) {
  try {
    const src = fs.readFileSync(entryAbs, "utf8");
    return (
      /export\s+(async\s+)?function\s+mount\b/.test(src) ||
      /export\s+(const|let|var)\s+mount\b/.test(src) ||
      /export\s*\{[^}]*\bmount\b[^}]*\}/.test(src)
    );
  } catch {
    return false;
  }
}
