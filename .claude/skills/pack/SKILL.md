---
name: pack
description: 把 chat.html 及其图标、可视化 iframe 页面打包成零外部依赖的单文件 HTML，输出到 dist/ 并带时间戳。当用户说「打包」「出一份单文件」「重新打包」「生成分享版」「build standalone」时使用。
---

# 打包单文件 HTML

## 做什么

跑 `node tools/build-standalone.js`。它会内联 [chat.html](../../../chat.html) 引用的
`src/pic/icon/` 图标，以及聊天可视化 iframe 使用的 `v15-report-modules-pto.html`
和该页面引用的本地 CSS/JS，产出
`dist/chat.standalone.<YYYYMMDD-HHmm>.html` —— 零外部依赖,可以直接发给别人双击打开。

源文件 chat.html 不会被改动,始终保持相对路径的可编辑状态。

## 步骤

1. **打包**

   ```
   node tools/build-standalone.js
   ```

   脚本自己扫描依赖：静态的 `src="src/pic/icon/xxx"`、JS 里 `icon: 'xxx'`
   字面量，以及 iframe 子页的本地 `<link>` / `<script src>`，都会自动收进来。
   iframe 子页以内联 `data:` URL 承载，并通过 hash 接收 module、size、theme 参数。

2. **校验产物**(必做,成本很低)

   脚本成功退出即已完成相对图标和 iframe HTML 引用的自检。再抽出主页面内联 JS
   做语法检查：

   ```
   node -e "const fs=require('fs');const h=fs.readFileSync(process.argv[1],'utf8');for(const [i,m] of [...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].entries()){try{new Function(m[1])}catch(e){throw new Error('script '+(i+1)+': '+e.message)}}console.log('JS 语法 OK')" dist/chat.standalone.<时间戳>.html
   ```

3. **回报**:文件名、体积、内联图标数量、两项校验结果。一句话即可,不要长篇。

## 出错时怎么办

脚本有意在异常时中断,不会静默出坏包。两类报错:

- **`没匹配到动态引用(chat.html 结构变了?)`** —— chat.html 里靠变量拼路径的写法变了。
  脚本 `dynamic` 数组里那几条精确匹配对不上了,去 chat.html 找到新的写法,
  在数组里加一条「原文 → 改成查 `WZH_ICON` 表」的规则。
- **`还有没内联的引用`** —— 主页面出现了新的相对图片路径写法。按报错上下文补规则。
- **`嵌入页还有未内联资源`** —— `v15-report-modules-pto.html` 新增了本地依赖，扩展打包脚本的资源规则。
- **`没匹配到可视化 iframe 引用`** —— `visualizationFrameSrc()` 的原文变了，同步更新脚本中的精确替换。

## 别做的事

- 不要把 base64 写回 chat.html —— 源文件要保持可编辑。
- 不要起本地服务或开浏览器验证(见全局约定),视觉确认交给用户。
- 不要清理 dist/ 里的历史包,除非用户明确要求。
