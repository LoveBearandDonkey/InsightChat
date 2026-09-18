---
name: pack
description: 把 chat.html 打包成不依赖外部文件的单文件 HTML,输出到 dist/ 并带时间戳。当用户说「打包」「出一份单文件」「重新打包」「生成分享版」「build standalone」时使用。
---

# 打包单文件 HTML

## 做什么

跑 `node tools/build-standalone.js`,它把 [chat.html](../../../chat.html) 里引用的
`src/pic/icon/` 图标全部转成 base64 内联,产出
`dist/chat.standalone.<YYYYMMDD-HHmm>.html` —— 零外部依赖,可以直接发给别人双击打开。

源文件 chat.html 不会被改动,始终保持相对路径的可编辑状态。

## 步骤

1. **打包**

   ```
   node tools/build-standalone.js
   ```

   脚本自己扫描依赖:静态的 `src="src/pic/icon/xxx"`、JS 里 `icon: 'xxx'` 字面量,
   都会自动收进来。新增图标不需要改脚本。

2. **校验产物**(必做,成本很低)

   ```
   grep -o 'src="src/pic/[^"]*"' dist/chat.standalone.<刚生成的时间戳>.html || echo "无相对引用 ✓"
   ```

   再抽出内联 JS 过一遍语法:

   ```
   node -e "const fs=require('fs');const f=process.argv[1];const h=fs.readFileSync(f,'utf8');const p=[...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);fs.writeFileSync(process.env.TMP+'/all.js',p.join('\n;\n'));" dist/chat.standalone.<时间戳>.html && node --check "$TMP/all.js" && echo "JS 语法 OK"
   ```

3. **回报**:文件名、体积、内联图标数量、两项校验结果。一句话即可,不要长篇。

## 出错时怎么办

脚本有意在异常时中断,不会静默出坏包。两类报错:

- **`没匹配到动态引用(chat.html 结构变了?)`** —— chat.html 里靠变量拼路径的写法变了。
  脚本 `dynamic` 数组里那几条精确匹配对不上了,去 chat.html 找到新的写法,
  在数组里加一条「原文 → 改成查 `WZH_ICON` 表」的规则。
- **`还有没内联的引用`** —— 出现了新的相对资源路径写法。按报错里打印的上下文补规则。

## 别做的事

- 不要把 base64 写回 chat.html —— 源文件要保持可编辑。
- 不要起本地服务或开浏览器验证(见全局约定),视觉确认交给用户。
- 不要清理 dist/ 里的历史包,除非用户明确要求。
