import { noise2D } from "@remotion/noise";
import { random } from "remotion";
import { CANDY, COLORS } from "../theme";

/**
 * 镜头 1 开场那二三十张性能图表碎片。
 *
 * 五种形态照着真界面来：kernel_details.csv 的数据表格、泳道任务条、
 * HBM 带宽面积图、占比饼图、通信矩阵热力块。全部白底卡片 + 细边框 + 轻投影，
 * 填充只从泳道那 6 个糖果色里取 —— 抽象段和真实界面用同一套颜色，
 * 到镜头 3 切录屏时观众感觉不到接缝。
 *
 * ⚠️ 审片意见（局部 1）落在这里：
 *   · 泳道卡加宽、向画幅中心收 —— 泳道图本来就该是横条形，散在四角读不出来；
 *   · 一部分折线填充图改成饼图，一部分宫格热力图改成抽象数据表格；
 *   · **图形本身也要动**，不能只有数字在跳：热力宫格明暗起伏、面积图末端读数点跟着跳、
 *     饼图扇区角度缓慢呼吸。密度 + 微动 = 「读不过来」，这是这一秒唯一要说的事。
 *
 * 布局是 random(seed) 生成的，确定性、每次渲染一样，别改成 Math.random()。
 */

export type ShardKind = "table" | "lane" | "area" | "heat" | "pie";

export type ShardSpec = {
  id: number;
  /** 落位中心（1920×1080 画幅坐标） */
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  kind: ShardKind;
  candy: string;
  /** 入场帧，0–12 内错开，读起来像「涌进来」而不是「一起亮」 */
  enterAt: number;
  /** 入场起点：画幅外，沿着离心方向 */
  fromX: number;
  fromY: number;
};

const COLS = 7;
const ROWS = 4;
/** table 权重最高（最像真的性能表），heat 压到一份 —— 审片说宫格太多 */
const KINDS: ShardKind[] = [
  "table",
  "lane",
  "area",
  "table",
  "pie",
  "lane",
  "heat",
  "table",
];

export const SHARDS: ShardSpec[] = Array.from(
  { length: COLS * ROWS },
  (_, i): ShardSpec => {
    const r = (k: string) => random(`shard-${i}-${k}`);
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const kind = KINDS[Math.floor(r("k") * KINDS.length)];
    const lane = kind === "lane";

    let x = (col + 0.5) * (1920 / COLS) + (r("jx") - 0.5) * 170;
    let y = (row + 0.5) * (1080 / ROWS) + (r("jy") - 0.5) * 150;
    // 泳道卡往中间靠 22%：横条形的东西摆在画幅正中才读得出来
    if (lane) {
      x += (960 - x) * 0.22;
      y += (540 - y) * 0.12;
    }

    const dx = x - 960;
    const dy = y - 540;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    return {
      id: i,
      x,
      y,
      // 泳道卡加宽（420–500），其余照旧
      w: lane ? 420 + r("w") * 80 : 250 + r("w") * 160,
      h: lane ? 140 + r("h") * 60 : 148 + r("h") * 104,
      rot: (r("rot") - 0.5) * (lane ? 5 : 9),
      kind,
      candy: CANDY[Math.floor(r("c") * CANDY.length)],
      enterAt: Math.floor(r("t") * 13),
      fromX: x + (dx / len) * 620,
      fromY: y + (dy / len) * 460,
    };
  },
);

const TITLES = [
  "kernel_details.csv",
  "op_statistic.csv",
  "step_trace_time.csv",
  "communication.json",
  "HBM read/Bandwidth",
  "Overlap Analysis",
  "AI Core Freq",
  "communication_matrix",
  "api_statistic.csv",
  "NPU MEM",
];

/** 每两帧跳一次的数字：不是真数据，是「读不过来」的那种躁动 */
const jitterNumber = (id: number, f: number, digits: number) => {
  const bucket = Math.floor(f / 2);
  const v = random(`num-${id}-${bucket}`) * 100;
  return digits === 0 ? String(Math.round(v)) : v.toFixed(digits);
};

/** 抽象数据表格：表头 + 4 行「标签条 + 右对齐读数」，比宫格更像真的性能表 */
const Table: React.FC<{ spec: ShardSpec; f: number }> = ({ spec, f }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
    {/* 表头 */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingBottom: 4,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div style={{ width: "42%", height: 6, borderRadius: 3, background: "rgba(0,0,0,0.16)" }} />
      <div style={{ flex: 1 }} />
      <div style={{ width: 34, height: 6, borderRadius: 3, background: "rgba(0,0,0,0.16)" }} />
    </div>
    {Array.from({ length: 4 }, (_, row) => {
      const hot = row === Math.floor(random(`hot-${spec.id}`) * 4);
      return (
        <div
          key={row}
          style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}
        >
          <div
            style={{
              width: `${34 + random(`tw-${spec.id}-${row}`) * 26}%`,
              height: 8,
              borderRadius: 3,
              background: hot ? spec.candy : "rgba(0,0,0,0.09)",
            }}
          />
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
              color: hot ? COLORS.fg : COLORS.fgSecondary,
              fontWeight: hot ? 700 : 400,
            }}
          >
            {jitterNumber(spec.id * 10 + row, f, 2)}
          </div>
        </div>
      );
    })}
  </div>
);

/** 泳道任务条。加宽之后行数也多给两行，读起来才像真的 timeline */
const Lane: React.FC<{ spec: ShardSpec; f: number }> = ({ spec, f }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
    {Array.from({ length: 6 }, (_, row) => (
      <div key={row} style={{ display: "flex", gap: 3, flex: 1, minHeight: 9 }}>
        {Array.from({ length: 11 }, (_, cell) => {
          const rr = random(`lane-${spec.id}-${row}-${cell}`);
          // 任务条自己也有一点点明暗呼吸，整墙才不是死的
          const breathe =
            0.78 + 0.22 * (0.5 + 0.5 * noise2D(`lb-${spec.id}-${row}`, f / 22, cell));
          return (
            <div
              key={cell}
              style={{
                width: `${4 + rr * 16}%`,
                borderRadius: 2,
                background: CANDY[Math.floor(rr * CANDY.length)],
                opacity: breathe,
              }}
            />
          );
        })}
      </div>
    ))}
  </div>
);

/** 面积图：折线末端带一个跟着读数跳的圆点，图形本身也在动 */
const Area: React.FC<{ spec: ShardSpec; f: number }> = ({ spec, f }) => {
  const N = 22;
  const val = (i: number) => {
    const base = 0.25 + random(`area-${spec.id}-${i}`) * 0.6;
    // 整条曲线随帧缓慢起伏，末端起伏最大 —— 像正在刷新的实时曲线
    const wave = noise2D(`aw-${spec.id}`, f / 24, i / 3) * 0.09 * (0.35 + i / N);
    return Math.max(0.05, Math.min(0.97, base + wave));
  };
  const pts = Array.from({ length: N }, (_, i) => {
    return `${(i / (N - 1)) * 100},${(1 - val(i)) * 100}`;
  }).join(" ");
  const lastY = (1 - val(N - 1)) * 100;

  return (
    <div style={{ flex: 1, position: "relative", display: "flex" }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ flex: 1, width: "100%" }}
      >
        <polygon points={`0,100 ${pts} 100,100`} fill={spec.candy} />
        <polyline
          points={pts}
          fill="none"
          stroke="rgba(0,0,0,0.16)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* 末端读数点：不缩放，所以画在 non-scaling 的坐标里 */}
        <circle
          cx={100}
          cy={lastY}
          r={2.4}
          fill={COLORS.fg}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* 末端那个跟着跳的读数 */}
      <div
        style={{
          position: "absolute",
          right: 2,
          top: `${Math.max(0, Math.min(72, lastY - 18))}%`,
          fontSize: 11,
          fontWeight: 700,
          color: COLORS.fg,
          fontVariantNumeric: "tabular-nums",
          background: "rgba(255,255,255,0.82)",
          borderRadius: 3,
          padding: "0 3px",
        }}
      >
        {jitterNumber(spec.id * 7 + 3, f, 1)}
      </div>
    </div>
  );
};

/** 占比饼图：扇区角度缓慢呼吸，中间留一枚跳动的总数 */
const Pie: React.FC<{ spec: ShardSpec; f: number }> = ({ spec, f }) => {
  const N = 5;
  const raw = Array.from({ length: N }, (_, i) => {
    const base = 0.6 + random(`pie-${spec.id}-${i}`) * 1.4;
    return Math.max(0.2, base + noise2D(`pw-${spec.id}`, f / 30, i) * 0.28);
  });
  const total = raw.reduce((s, v) => s + v, 0);

  let acc = 0;
  const stops = raw
    .map((v, i) => {
      const from = (acc / total) * 360;
      acc += v;
      const to = (acc / total) * 360;
      const color = CANDY[(Math.floor(random(`pc-${spec.id}-${i}`) * CANDY.length) + i) % CANDY.length];
      return `${color} ${from.toFixed(2)}deg ${to.toFixed(2)}deg`;
    })
    .join(", ");

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          height: "100%",
          borderRadius: "50%",
          background: `conic-gradient(from -90deg, ${stops})`,
        }}
      >
        {/* 环心那枚总数：留白 + 跳动读数，比实心饼更像看板 */}
        <div
          style={{
            position: "absolute",
            inset: "26%",
            borderRadius: "50%",
            background: COLORS.surface1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: COLORS.fg,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {jitterNumber(spec.id * 5 + 1, f, 0)}
        </div>
      </div>
    </div>
  );
};

/** 通信矩阵热力块：每格明暗按噪声微弱起伏 —— 数字在跳的同时，图形也在跳 */
const Heat: React.FC<{ spec: ShardSpec; f: number }> = ({ spec, f }) => (
  <div
    style={{
      flex: 1,
      display: "grid",
      gridTemplateColumns: "repeat(8, 1fr)",
      gridAutoRows: "1fr",
      gap: 3,
    }}
  >
    {Array.from({ length: 32 }, (_, i) => {
      const rr = random(`heat-${spec.id}-${i}`);
      const pulse = noise2D(`hp-${spec.id}`, f / 18, i / 2.5);
      return (
        <div
          key={i}
          style={{
            borderRadius: 2,
            background: CANDY[Math.floor(rr * CANDY.length)],
            opacity: Math.max(0.18, Math.min(1, 0.35 + rr * 0.65 + pulse * 0.3)),
          }}
        />
      );
    })}
  </div>
);

/**
 * 一张碎片。位置 / 缩放 / 透明度全部由场景算好后传进来，
 * 组件本身不取帧 —— 镜头 1 的收拢是整组一起走的。
 */
export const Shard: React.FC<{
  spec: ShardSpec;
  f: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
}> = ({ spec, f, x, y, scale, opacity }) => {
  // 碎片各自的微漂移：噪声驱动，让「铺满」这一秒不是死的
  const driftX = noise2D(`dx-${spec.id}`, f / 26, 0) * 7;
  const driftY = noise2D(`dy-${spec.id}`, f / 26, 9) * 6;

  return (
    <div
      style={{
        position: "absolute",
        left: x - spec.w / 2 + driftX,
        top: y - spec.h / 2 + driftY,
        width: spec.w,
        height: spec.h,
        opacity,
        transform: `scale(${scale}) rotate(${spec.rot}deg)`,
        background: COLORS.surface1,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        boxShadow: "0 8px 22px rgba(0,0,0,0.07)",
        padding: "10px 12px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: spec.candy,
          }}
        />
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.fgSecondary,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {TITLES[spec.id % TITLES.length]}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.fg,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {jitterNumber(spec.id, f, 1)}
        </div>
      </div>
      {spec.kind === "table" ? <Table spec={spec} f={f} /> : null}
      {spec.kind === "lane" ? <Lane spec={spec} f={f} /> : null}
      {spec.kind === "area" ? <Area spec={spec} f={f} /> : null}
      {spec.kind === "pie" ? <Pie spec={spec} f={f} /> : null}
      {spec.kind === "heat" ? <Heat spec={spec} f={f} /> : null}
    </div>
  );
};
