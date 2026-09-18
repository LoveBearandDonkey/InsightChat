/**
 * 示例 2：原生 Canvas 2D + requestAnimationFrame
 * 用来验证 rAF 被虚拟时钟接管后依然逐帧可复现。
 * 约定：导出 mount(element, props)。
 */
export function mount(el: HTMLElement, props: { color?: string } = {}) {
  const size = 200;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = canvas.style.height = size + "px";
  el.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  const color = props.color ?? "#4f7dff";
  const DOTS = 8;

  function frame(t: number) {
    // 关键：clearRect 而不是 fillRect，保留透明底
    ctx.clearRect(0, 0, size, size);
    const phase = (t / 1400) * Math.PI * 2;

    for (let i = 0; i < DOTS; i++) {
      const a = (i / DOTS) * Math.PI * 2 + phase;
      const r = 66 + Math.sin(phase * 2 + i) * 10;
      const x = size / 2 + Math.cos(a) * r;
      const y = size / 2 + Math.sin(a) * r;
      const s = 7 + Math.sin(phase * 3 + i * 0.7) * 3.5;

      ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(phase * 2 + i));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
