/* Adapted from the user-provided InsightChat app/desktop-chat.js.
   Reuses its fit, pointer/edge-resize and floating-preview geometry pattern.
   This window is a sibling of the IDE; it never docks into the IDE. */
(() => {
  'use strict';
  window.MS_FLOATING_WINDOW = function({desktop,frame,header,initialRect,onActivate,onVisibility}) {
    const clamp=(value,low,high)=>Math.min(Math.max(value,low),Math.max(low,high));
    const bounds=()=>({width:desktop.clientWidth||innerWidth,height:Math.max(0,(desktop.clientHeight||innerHeight-106)-42)});
    const initial=()=>{const {width,height}=bounds();const w=Math.min(1040,width-48),h=Math.min(760,height-48);return{x:Math.max(12,(width-w)/2),y:Math.max(16,(height-h)/2),w,h};};
    let state={...(initialRect?.()||initial()),maximized:false},visible=false,compact=null;
    let reportedVisibility=null,reportedMaximized=null,cancelPointer=null;
    function minimum(viewport=bounds()){const {width,height}=viewport,ide=desktop.querySelector('.ide');return{w:Math.min(700,width-16,ide?.offsetWidth||700),h:Math.min(430,height-16,ide?.offsetHeight||430)};}
    function fit(rect,viewport=bounds(),min=minimum(viewport)){const {width,height}=viewport;const w=clamp(rect.w,min.w,width-16),h=clamp(rect.h,min.h,height-16);return{x:clamp(rect.x,0,width-w),y:clamp(rect.y,0,height-h),w,h};}
    function render(viewport=bounds(),min=minimum(viewport)){
      const {width,height}=viewport,rect=state.maximized?{x:0,y:0,w:width,h:height}:fit(state,viewport,min);
      if(!state.maximized)Object.assign(state,rect);
      for(const [property,value] of Object.entries({left:rect.x,top:rect.y,width:rect.w,height:rect.h})){const px=Math.round(value)+'px';if(frame.style[property]!==px)frame.style[property]=px;}
      if(frame.classList.contains('is-maximized')!==state.maximized)frame.classList.toggle('is-maximized',state.maximized);
      if(frame.hidden===visible)frame.hidden=!visible;
      // Position and size changes do not change the taskbar/window-button state.
      if(reportedVisibility!==visible||reportedMaximized!==state.maximized){reportedVisibility=visible;reportedMaximized=state.maximized;onVisibility?.(visible,state.maximized);}
    }
    function activate(){if(visible)onActivate?.();}
    function open(){visible=true;render();activate();}
    function hide(){cancelPointer?.();visible=false;render();}
    function maximize(){cancelPointer?.();state.maximized=!state.maximized;render();activate();}
    function animate(){frame.classList.add('is-viz-expanding');clearTimeout(animate.timer);animate.timer=setTimeout(()=>frame.classList.remove('is-viz-expanding'),340);}
    function expand(){if(state.maximized)return;const {width}=bounds();const target=Math.max(state.w,Math.min(1800,width-48));if(target<=state.w)return;if(!compact)compact={...state};animate();Object.assign(state,{w:target,x:Math.max(8,(width-target)/2)});render();}
    function contract(){if(!compact||state.maximized)return;animate();Object.assign(state,compact);compact=null;render();}
    function pointer(event,move,done){
      if(event.button!==0)return;
      cancelPointer?.();event.preventDefault();
      const x=event.clientX,y=event.clientY,target=event.currentTarget;
      let dx=0,dy=0,appliedX=0,appliedY=0,pending=0,ended=false;
      clearTimeout(animate.timer);frame.classList.remove('is-viz-expanding');
      frame.classList.add('is-pointer-active');document.body.classList.add('is-agent-dragging');
      const samePointer=next=>event.pointerId===undefined||next.pointerId===undefined||next.pointerId===event.pointerId;
      const flush=()=>{pending=0;if(dx===appliedX&&dy===appliedY)return;move(dx,dy);appliedX=dx;appliedY=dy;};
      const onMove=next=>{if(!samePointer(next))return;dx=next.clientX-x;dy=next.clientY-y;if(!pending)pending=requestAnimationFrame(flush);};
      const end=next=>{
        if(ended||(next&&!samePointer(next)))return;ended=true;
        if(next?.type==='pointerup'){dx=next.clientX-x;dy=next.clientY-y;}
        if(pending){cancelAnimationFrame(pending);pending=0;}flush();
        window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);window.removeEventListener('blur',end);target.removeEventListener('lostpointercapture',end);
        cancelPointer=null;
        try{done?.();}finally{frame.classList.remove('is-pointer-active','is-window-dragging');document.body.classList.remove('is-agent-dragging');if(Number.isFinite(event.pointerId)&&target.hasPointerCapture?.(event.pointerId))target.releasePointerCapture(event.pointerId);}
      };
      cancelPointer=()=>end();
      window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);window.addEventListener('blur',end);target.addEventListener('lostpointercapture',end);
      if(Number.isFinite(event.pointerId))try{target.setPointerCapture?.(event.pointerId);}catch(_){}
    }
    header.addEventListener('pointerdown',event=>{
      if(state.maximized||event.target.closest('button,input,select,textarea,a'))return;
      if(event.button!==0)return;
      cancelPointer?.();const start={...state,x:Math.round(state.x),y:Math.round(state.y)},viewport=bounds(),min=minimum(viewport);
      pointer(event,(dx,dy)=>{
        state.x=clamp(start.x+dx,0,viewport.width-start.w);state.y=clamp(start.y+dy,0,viewport.height-start.h);
        // Keep workbench geometry fixed while moving; commit coordinates once on release.
        frame.style.transform=`translate3d(${Math.round(state.x-start.x)}px, ${Math.round(state.y-start.y)}px, 0)`;
      },()=>{render(viewport,min);frame.style.transform='';});
      frame.classList.add('is-window-dragging');
    });
    header.addEventListener('dblclick',event=>{if(!event.target.closest('button,input,select,textarea,a'))maximize();});
    function resized(start,edge,dx,dy,b=bounds(),min=minimum(b)){const result={...start};if(edge.includes('w')){result.x=clamp(start.x+dx,0,start.x+start.w-min.w);result.w=start.x+start.w-result.x;}if(edge.includes('e'))result.w=clamp(start.w+dx,min.w,b.width-start.x);if(edge.includes('n')){result.y=clamp(start.y+dy,0,start.y+start.h-min.h);result.h=start.y+start.h-result.y;}if(edge.includes('s'))result.h=clamp(start.h+dy,min.h,b.height-start.y);return result;}
    for(const edge of ['n','e','s','w','ne','se','sw','nw']){const handle=document.createElement('div');handle.className='agent-resize agent-resize--'+edge;handle.dataset.agentResize=edge;handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-label','Resize msAgent '+edge);frame.append(handle);handle.addEventListener('pointerdown',event=>{if(state.maximized||event.button!==0)return;event.stopPropagation();const start={...state},viewport=bounds(),min=minimum(viewport);pointer(event,(dx,dy)=>{Object.assign(state,resized(start,edge,dx,dy,viewport,min));compact=null;render(viewport,min);});});handle.addEventListener('keydown',event=>{const delta={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[event.key];if(!delta||state.maximized)return;event.preventDefault();const viewport=bounds(),min=minimum(viewport);Object.assign(state,resized(state,edge,...delta,viewport,min));render(viewport,min);});}
    frame.addEventListener('pointerdown',activate,{capture:true});window.addEventListener('resize',()=>{cancelPointer?.();render();});render();
    return{open,hide,maximize,expand,contract,activate,get visible(){return visible;},get maximized(){return state.maximized;}};
  };
})();
