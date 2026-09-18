/**
 * 示例 4：原生 WebGL（零依赖）
 *
 * 这个文件不引任何三方库，专门用来做**环境自检**：
 * 如果它能导出带透明底的动图，说明这台机器上的
 * 无头 Chrome + SwiftShader 软件渲染 + alpha 通道截图 整条链路是通的。
 * 之后你们自己的 three.js 图标才有保障。
 *
 * `npm run doctor` 跑的就是它。
 */
export function mount(el: HTMLElement, props: { size?: number } = {}) {
  const size = props.size ?? 160;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = canvas.style.height = size + "px";
  el.appendChild(canvas);

  const gl = canvas.getContext("webgl", {
    alpha: true,                 // 允许透明
    antialias: true,
    preserveDrawingBuffer: true, // 无头截图必须开
  }) as WebGLRenderingContext | null;

  if (!gl) {
    // 让 CLI 能拿到明确的失败原因，而不是导出一张空白图
    throw new Error("拿不到 WebGL context —— 这台机器的无头 Chrome 不支持 WebGL");
  }

  const vs = `
    attribute vec2 aPos;
    attribute vec3 aColor;
    uniform float uAngle;
    uniform float uScale;
    varying vec3 vColor;
    void main() {
      float c = cos(uAngle), s = sin(uAngle);
      vec2 p = mat2(c, -s, s, c) * aPos * uScale;
      gl_Position = vec4(p, 0.0, 1.0);
      vColor = aColor;
    }`;

  const fs = `
    precision mediump float;
    varying vec3 vColor;
    void main() { gl_FragColor = vec4(vColor, 1.0); }`;

  function compile(type: number, src: string) {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
      throw new Error("shader 编译失败: " + gl!.getShaderInfoLog(sh));
    }
    return sh;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("program 链接失败: " + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  // 六瓣花：中心点 + 6 个外顶点组成的 triangle fan
  const SEGMENTS = 6;
  const verts: number[] = [0, 0, 1, 1, 1];
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const hue = i / SEGMENTS;
    verts.push(
      Math.cos(a) * 0.85, Math.sin(a) * 0.85,
      0.35 + 0.55 * Math.abs(Math.sin(hue * Math.PI)),
      0.5 + 0.4 * Math.cos(hue * Math.PI * 2),
      0.95
    );
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

  const STRIDE = 5 * 4;
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, STRIDE, 0);

  const aColor = gl.getAttribLocation(prog, "aColor");
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, STRIDE, 2 * 4);

  const uAngle = gl.getUniformLocation(prog, "uAngle");
  const uScale = gl.getUniformLocation(prog, "uScale");

  gl.clearColor(0, 0, 0, 0); // 背景全透明
  gl.viewport(0, 0, size, size);

  const PERIOD = 2000; // 2 秒一圈，导出时长设 2s 即可无缝循环

  function frame(t: number) {
    const phase = ((t % PERIOD) / PERIOD) * Math.PI * 2;
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform1f(uAngle, phase);
    gl!.uniform1f(uScale, 0.72 + Math.sin(phase * 2) * 0.12);
    gl!.drawArrays(gl!.TRIANGLE_FAN, 0, SEGMENTS + 2);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
