/* Monaco 0.55.1, vendored locally. It supplies the actual VS Code editor core.
   The shell remains usable with its textarea fallback on unsupported/file URL hosts. */
(() => {
  'use strict';
  const bridge = window.MS_EDITOR = {ready:false, instance:null, path:null, models:new Map(), views:new Map(), preferences:{fontSize:14,minimap:{enabled:true,renderCharacters:true,maxColumn:100,scale:1}}};
  const languages = {yaml:'yaml',yml:'yaml',sh:'shell',py:'python',md:'markdown',json:'json',log:'plaintext'};
  let subscription;
  const base = new URL('vendor/monaco/vs', document.baseURI).href;

  bridge.dispose = () => {
    if(bridge.instance && bridge.path) bridge.views.set(bridge.path,bridge.instance.saveViewState());
    subscription?.dispose();subscription=null;
    bridge.instance?.dispose();bridge.instance=null;bridge.path=null;
  };
  bridge.focus = () => bridge.instance?.focus();
  bridge.action = id => bridge.instance?.getAction(id)?.run();
  bridge.options = options => {Object.assign(bridge.preferences,options);bridge.instance?.updateOptions(options);};
  bridge.mount = (container,path,value,onChange,line=0) => {
    bridge.dispose();
    const m=window.monaco;const uri=m.Uri.parse('file:///home/linlan/xinghe-moe-training/'+path);
    let model=bridge.models.get(path);
    if(!model){model=m.editor.createModel(value,languages[path.split('.').pop()]||'plaintext',uri);bridge.models.set(path,model);}
    else if(model.getValue()!==value)model.setValue(value);
    const editor=m.editor.create(container,{model,theme:'ms-dark-modern',fontFamily:"Consolas, 'Courier New', monospace",fontSize:14,lineHeight:20,tabSize:2,insertSpaces:true,automaticLayout:true,minimap:{enabled:true,renderCharacters:true,maxColumn:100,scale:1},padding:{top:8,bottom:20},scrollBeyondLastLine:false,smoothScrolling:true,cursorBlinking:'blink',renderLineHighlight:'line',lineNumbersMinChars:3,glyphMargin:true,folding:true,showFoldingControls:'mouseover',guides:{indentation:true,highlightActiveIndentation:true,bracketPairs:false},bracketPairColorization:{enabled:true},overviewRulerBorder:false,hideCursorInOverviewRuler:true,wordWrap:'off',contextmenu:true,accessibilitySupport:'auto',scrollbar:{verticalScrollbarSize:10,horizontalScrollbarSize:10,alwaysConsumeMouseWheel:false}});
    bridge.instance=editor;bridge.path=path;
    editor.updateOptions(bridge.preferences);
    if(bridge.views.has(path))editor.restoreViewState(bridge.views.get(path));
    function mark(){const conflict=path==='scripts/train_npu.sh'&&model.getValue().includes('--recompute-granularity full');m.editor.setModelMarkers(model,'ms-demo',conflict?[{severity:m.MarkerSeverity.Warning,message:'此启动参数覆盖 configs/model.yaml 中的 recompute.granularity: selective。',source:'配置检查',startLineNumber:9,startColumn:17,endLineNumber:9,endColumn:45}]:[]);}
    mark();subscription=model.onDidChangeContent(()=>{mark();onChange(model.getValue());});
    editor.onDidChangeCursorPosition(e=>{const status=document.getElementById('cursorStatus');if(status)status.textContent=`行 ${e.position.lineNumber}，列 ${e.position.column}`;});
    if(line){editor.setPosition({lineNumber:line,column:1});editor.revealLineInCenter(line);editor.createDecorationsCollection([{range:new m.Range(line,1,line,1),options:{isWholeLine:true,className:'source-reveal-line'}}]);}
    return editor;
  };
  bridge.mountDiff = (container,original,modified,language='shell') => {
    bridge.dispose();
    const m=window.monaco;
    const before=m.editor.createModel(original,language);const after=m.editor.createModel(modified,language);
    const editor=m.editor.createDiffEditor(container,{theme:'ms-dark-modern',readOnly:true,originalEditable:false,automaticLayout:true,renderSideBySide:true,useInlineViewWhenSpaceIsLimited:false,fontSize:13,lineHeight:20,fontFamily:"Consolas, 'Courier New', monospace",minimap:{enabled:false},scrollBeyondLastLine:false,padding:{top:8},hideUnchangedRegions:{enabled:false},renderOverviewRuler:false});
    editor.setModel({original:before,modified:after});editor.getModifiedEditor().revealLineInCenter(9);
    bridge.instance=editor;bridge.path=null;editor.onDidDispose(()=>{before.dispose();after.dispose();});
  };
  // jsdom has no rendering engine; keep meaningful state tests on the fallback.
  if(!window.matchMedia||!window.ResizeObserver||typeof window.require!=='function'||location.protocol==='file:')return;
  window.require.config({paths:{vs:base}});
  window.require(['vs/editor/editor.main'],() => {
    const m=window.monaco;
    m.editor.defineTheme('ms-dark-modern',{base:'vs-dark',inherit:true,rules:[],colors:{'editor.background':'#1f1f1f','editor.foreground':'#cccccc','editorGutter.background':'#1f1f1f','editorLineNumber.foreground':'#6e7681','editorLineNumber.activeForeground':'#cccccc','editor.lineHighlightBorder':'#282828','editorIndentGuide.background1':'#404040','editorIndentGuide.activeBackground1':'#707070','editor.selectionBackground':'#264f78','scrollbarSlider.background':'#79797966','minimap.background':'#1f1f1f','editorWidget.background':'#202020','editorWidget.border':'#454545'}});
    // Monaco adds its stylesheet at runtime; keep workbench overrides after it.
    const shellCss=document.querySelector('link[href="styles.css"]');
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{if(link.href.endsWith('/editor/editor.main.css'))document.head.insertBefore(link,shellCss);});
    bridge.ready=true;window.dispatchEvent(new Event('ms:editor-ready'));
  },error=>{console.warn('Monaco unavailable; using local editor fallback.',error);});
})();
