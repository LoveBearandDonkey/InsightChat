import { COLORS, FONT_FAMILY, phsColorAt } from "../theme";

/**
 * 精密仪表盘 —— 镜头 1 收束的落点，也是镜头 2 破墙的起点。
 *
 * ⚠️ 两镜之间是 fade 转场，只有「同一个盘、同样的几何」才看不出接缝，
 * 所以尺寸和圆心走下面这两个常量，两个场景都别各写各的。
 *
 * ⚠️ v2 审片意见（局部 2 / 3 / 4）也落在这里：
 *   · **没迈过去的区段永远不填色**。原来「墙」是把 `wallAt → 100` 整段弧染红、
 *     连墙后的刻线也一起闪红 —— 于是指针明明卡在 75，75~100 却红了一下，说不通。
 *     现在墙是 75 那一格上的**一道径向栏杆**：撞上去只有栏杆自己亮红，破墙时栏杆碎掉；
 *     刻度环那一段从头到尾都是底轨灰；
 *   · 刻度数字由「每 20 一个」加密到**每 10 一个**，弱刻线和内圈细环各提亮一档
 *     （仍比整十线弱，但看得见）；
 *   · 指针不再死停：`gaugeTremor()` 给一支确定性的微颤（见下）。
 *
 * ⚠️ 审片意见（局部 4 / 5 / 6）落在这里：
 *   · **去掉 "PHS 75 / 100" 那行**，改成盘内一枚大读数，随指针实时跳（指针右偏 → 数字跟着涨）；
 *   · 读数放在**盘内**（圆心下方，开口那块空地），始终可见，不会像原来那样掉出盘外；
 *   · 指针扫过的色条按分数**从 0 分红渐变到 100 分绿**（phsColorAt，抄自浅色主题那只 PHS 仪表盘）；
 *   · 刻度加密、补内环与玻璃高光、指针改细长锥形 + 配重尾 —— 要「精密美观」。
 */
export const GAUGE_SIZE = 460;
export const GAUGE_CENTER = { x: 960, y: 470 };

/** SVG 内部坐标系：400×400，圆心 200,200 */
const VIEW = 400;
const CX = 200;
const CY = 200;
/** 刻度环半径 */
const R = 152;
/** 盘面半径 */
const FACE = 186;

/** 0 → 150°，100 → 390°（= 30°），共 240° 的经典表盘开口 */
const angleOf = (v: number) => 150 + (v / 100) * 240;

const pt = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
};

const arc = (r: number, v0: number, v1: number) => {
  const a0 = angleOf(v0);
  const a1 = angleOf(v1);
  const p0 = pt(r, a0);
  const p1 = pt(r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const rgba = (r: number, g: number, b: number, a: number) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(3)})`;

/** 尾迹分成这么多段逐段取色，于是「红 → 绿」是真的连续渐变，而不是一条纯蓝 */
const TRAIL_SEGMENTS = 72;

/**
 * 指针微颤（v2 审片局部 4：「3~5 秒仪表盘指针过于静止，画面很死，可以在 74~75 间抖动」）。
 *
 * 两支不相约的正弦叠加，**不是随机数** —— 渲染必须可复现，而且要能跨镜头接得上。
 * 振幅上限 ±0.46 分：指针尖来回约 2.5px，看得出在活，
 * 而 `Math.round(75 ± 0.46)` 恒等于 75，盘内那枚读数不会闪。
 *
 * ⚠️ **相位必须跨镜连续**：镜头 1 传 `t = f`，镜头 2 传 `t = f + 120`
 * （120 = 镜头 1 的帧数，也正好是镜头 2 的 f=0 在全片时间轴上的位置）。
 * 两边喂同一条曲线，fade 转场那 16 帧里两个盘的指针才严丝合缝 ——
 * 否则又会变成审片说的那种「拼接处主角抖一下」。
 */
export const gaugeTremor = (t: number): number =>
  0.3 * Math.sin(t * 0.47) + 0.16 * Math.sin(t * 0.191 + 1.3);

export type GaugeProps = {
  /** 指针读数 0–100 */
  value: number;
  /** 屏幕上的直径，默认 GAUGE_SIZE */
  size?: number;
  /** 「墙」在哪一格。null = 不画墙 */
  wallAt?: number | null;
  /** 撞墙红闪 0–1 */
  wallFlash?: number;
  /** 墙本身的可见度 0–1（镜头 2 破墙时降到 0） */
  wallOpacity?: number;
  /** 整盘透明度，形变成 logo 时用 */
  faceOpacity?: number;
  /** 盘内那枚大读数的可见度。默认 1 —— 审片要求「分数要始终出现」 */
  scoreOpacity?: number;
};

export const Gauge: React.FC<GaugeProps> = ({
  value,
  size = GAUGE_SIZE,
  wallAt = null,
  wallFlash = 0,
  wallOpacity = 1,
  faceOpacity = 1,
  scoreOpacity = 1,
}) => {
  const v = Math.max(0, Math.min(100, value));
  const needleAngle = angleOf(v);
  const scoreColor = phsColorAt(v);

  // 刻线：每 2 一格小刻度，每 10 一格长刻度带数字 —— 比原来密一倍，才有「精密」的感觉
  const ticks: React.ReactNode[] = [];
  for (let t = 0; t <= 100; t += 2) {
    const major = t % 10 === 0;
    const a = angleOf(t);
    const outer = pt(R + (major ? 13 : 9), a);
    const inner = pt(R + (major ? -4 : 4), a);
    // ⚠️ 刻线**永远是灰的**：墙后那一段不再闪红（v2 局部 2）。
    // 弱线由 0.11 提到 0.20、整十线由 0.30 提到 0.42 —— 仍有强弱之分，但都看得见（v2 局部 3）
    ticks.push(
      <line
        key={`t${t}`}
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke={`rgba(0,0,0,${major ? 0.42 : 0.2})`}
        strokeWidth={major ? 2.4 : 1}
        strokeLinecap="round"
      />,
    );
    // 数字每 10 一个（v2 局部 3：要补上 10、30 这些）
    if (major) {
      const lp = pt(R - 27, a);
      ticks.push(
        <text
          key={`n${t}`}
          x={lp.x}
          y={lp.y}
          fill={COLORS.fgSecondary}
          fontSize={13}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {t}
        </text>,
      );
    }
  }

  // 尾迹：逐段取色。只画到 v 为止，最后一段按余数截断，指针尖和色条头永远咬合
  const trail: React.ReactNode[] = [];
  for (let i = 0; i < TRAIL_SEGMENTS; i++) {
    const v0 = (i / TRAIL_SEGMENTS) * 100;
    const v1 = ((i + 1) / TRAIL_SEGMENTS) * 100;
    if (v0 >= v) {
      break;
    }
    const end = Math.min(v1, v);
    // 相邻段各多画一点点，接缝处才不透底
    trail.push(
      <path
        key={`tr${i}`}
        d={arc(R, Math.max(0, v0 - 0.35), end)}
        fill="none"
        stroke={phsColorAt((v0 + end) / 2)}
        strokeWidth={9}
        strokeLinecap={i === 0 || end >= v ? "round" : "butt"}
      />,
    );
  }

  // 指针：细长锥形 + 反向配重尾，比原来那根粗锥更像仪表
  const needle = `M ${CX - 2.6} ${CY - 4.6} L ${CX + R - 10} ${CY - 1.25} L ${CX + R - 10} ${CY + 1.25} L ${CX - 2.6} ${CY + 4.6} Z`;
  const counterweight = `M ${CX - 2.6} ${CY - 4.6} L ${CX - 34} ${CY - 3} L ${CX - 34} ${CY + 3} L ${CX - 2.6} ${CY + 4.6} Z`;

  return (
    <div
      style={{
        position: "absolute",
        left: GAUGE_CENTER.x - size / 2,
        top: GAUGE_CENTER.y - size / 2,
        width: size,
        height: size,
        opacity: faceOpacity,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <defs>
          <filter
            id="gauge-shadow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="10"
              floodColor="#000000"
              floodOpacity="0.10"
            />
          </filter>
          {/* 盘面那道极淡的玻璃高光：左上打光，右下收暗 */}
          <linearGradient id="gauge-glass" x1="0.15" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="52%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.035" />
          </linearGradient>
        </defs>

        {/* 白色盘面 */}
        <circle
          cx={CX}
          cy={CY}
          r={FACE}
          fill={COLORS.surface1}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1.5}
          filter="url(#gauge-shadow)"
        />
        <circle cx={CX} cy={CY} r={FACE} fill="url(#gauge-glass)" />
        <circle
          cx={CX}
          cy={CY}
          r={FACE - 11}
          fill="none"
          stroke="rgba(0,0,0,0.09)"
          strokeWidth={1}
        />
        {/* 内环：贴着刻度里侧，把读数和刻度分成两层。
            v2 局部 3：这两圈灰线原来 0.045 太弱，几乎看不见，提到 0.09 */}
        <circle
          cx={CX}
          cy={CY}
          r={R - 42}
          fill="none"
          stroke="rgba(0,0,0,0.09)"
          strokeWidth={1}
        />

        {/* 底轨 */}
        <path
          d={arc(R, 0, 100)}
          fill="none"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth={9}
          strokeLinecap="round"
        />


        {ticks}

        {/* 读数尾迹：0 分红 → 100 分绿 */}
        {trail}

        {/*
          墙：75 那一格上的**一道径向栏杆**。
          ⚠️ v2 局部 2：绝不能再把 75~100 那段弧染色 —— 指针没迈过去的区段永远不填色。
          撞上去时只有栏杆自己亮红、外加一小片红晕；破墙时（wallOpacity → 0）栏杆碎掉。
        */}
        {wallAt !== null && wallOpacity > 0
          ? (() => {
              const a = angleOf(wallAt);
              const i0 = pt(R - 16, a);
              const o0 = pt(R + 18, a);
              const hot = rgba(255, 75, 123, 1);
              return (
                <g opacity={wallOpacity}>
                  {wallFlash > 0.01 ? (
                    <line
                      x1={i0.x}
                      y1={i0.y}
                      x2={o0.x}
                      y2={o0.y}
                      stroke={hot}
                      strokeWidth={16}
                      strokeLinecap="round"
                      opacity={0.3 * wallFlash}
                    />
                  ) : null}
                  <line
                    x1={i0.x}
                    y1={i0.y}
                    x2={o0.x}
                    y2={o0.y}
                    stroke={rgba(
                      mix(25, 255, wallFlash),
                      mix(25, 75, wallFlash),
                      mix(25, 123, wallFlash),
                      mix(0.34, 1, wallFlash),
                    )}
                    strokeWidth={mix(3.4, 5, wallFlash)}
                    strokeLinecap="round"
                  />
                </g>
              );
            })()
          : null}

        {/* 指针 + 轴心 */}
        <g transform={`rotate(${needleAngle} ${CX} ${CY})`}>
          <path d={needle} fill={COLORS.fg} />
          <path d={counterweight} fill={COLORS.fg} opacity={0.42} />
        </g>
        <circle cx={CX} cy={CY} r={13} fill={COLORS.surface1} />
        <circle
          cx={CX}
          cy={CY}
          r={13}
          fill="none"
          stroke="rgba(0,0,0,0.14)"
          strokeWidth={2}
        />
        <circle cx={CX} cy={CY} r={4.5} fill={COLORS.fg} />

        {/* 盘内大读数。开口朝下，圆心下方那块本来就是空地 —— 摆这儿永远掉不出去 */}
        <g opacity={scoreOpacity}>
          <text
            x={CX}
            y={CY + 62}
            fill={scoreColor}
            fontSize={62}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={FONT_FAMILY}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(v)}
          </text>
          <text
            x={CX}
            y={CY + 100}
            fill={COLORS.fgSecondary}
            fontSize={15}
            fontWeight={600}
            letterSpacing={3}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={FONT_FAMILY}
          >
            性能健康度
          </text>
        </g>
      </svg>
    </div>
  );
};
