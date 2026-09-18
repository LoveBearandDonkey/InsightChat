import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { COLORS, FONT_FAMILY } from "../theme";

/**
 * 镜头 2 后半：完整性能工作台一段段由线框转实。
 *
 * 关键是「不是只长出一个孤立的对话框」——
 * 中间的诊断视图先立住，再向左接通采集目录树、向右接入对话面板。
 * 传统工具没有消失，是第一次和对话连成了一个系统。
 *
 * ⚠️ 审片意见（局部 9）：原来有三条从 logo 长出去的「脉络线」——
 * 那正是审片说的「logo 长出奇怪的触角，并飞到界面上，太生硬」。
 * **整套 VEINS 已删掉**，改成镜头拉远 + 视角略偏转，让界面自己现出全貌（见 Shot2Expertise）。
 *
 * 三块区域的坐标量自 public/1920x1080页面截图.png（实际 3840×2160，等比缩到 1920×1080）。
 */

const SHOT = "1920x1080页面截图.png";

type Region = { x: number; y: number; w: number; h: number; label: string };

export const REGIONS: { left: Region; mid: Region; right: Region } = {
  left: { x: 0, y: 0, w: 222, h: 1080, label: "采集目录" },
  mid: { x: 222, y: 0, w: 1200, h: 1080, label: "诊断视图" },
  right: { x: 1422, y: 0, w: 498, h: 1080, label: "智能对话" },
};

/** 对话面板欢迎页头像的位置 */
export const AVATAR_SLOT = { x: 1670, y: 334, size: 60 };
/** 输入框：镜头 2 末段推近的落点，也是镜头 3 的起手位 */
export const INPUT_BOX = { x: 1448, y: 918, w: 451, h: 140 };

/**
 * 线框的颜色与虚线密度。
 *
 * ⚠️ v2 审片局部 6：「那个虚线骨架线框不要用蓝色要用灰色，而且用更细密的虚线」。
 * 蓝色让给指针、标注和 logo —— 骨架只是搭台的，不该抢戏。
 */
const WIRE = "rgba(0,0,0,0.22)";
const WIRE_DASH = "5 7";

/** 线框：每块区域几笔示意线，实景淡入时它同步褪掉 */
const wireframeOf = (r: Region, rows: number) => {
  const lines: React.ReactNode[] = [];
  for (let i = 1; i <= rows; i++) {
    const y = r.y + 90 + (i * (r.h - 160)) / (rows + 1);
    lines.push(
      <line
        key={`${r.label}-${i}`}
        x1={r.x + 26}
        y1={y}
        x2={r.x + r.w - 26}
        y2={y}
        stroke={WIRE}
        strokeWidth={1.2}
        strokeDasharray={WIRE_DASH}
        opacity={0.8}
      />,
    );
  }
  return lines;
};

const RegionReveal: React.FC<{
  region: Region;
  /** 0–1：线框 → 实景 */
  p: number;
  /** 实景擦除方向 */
  wipe: "down" | "right";
}> = ({ region, p, wipe }) => {
  if (p <= 0.001) {
    return null;
  }
  const grown = interpolate(p, [0, 0.72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bottom =
    wipe === "down"
      ? 1080 - region.y - region.h + region.h * (1 - grown)
      : 1080 - region.y - region.h;
  const right =
    wipe === "right"
      ? 1920 - region.x - region.w + region.w * (1 - grown)
      : 1920 - region.x - region.w;

  return (
    <AbsoluteFill
      style={{
        clipPath: `inset(${region.y}px ${right}px ${bottom}px ${region.x}px)`,
        opacity: interpolate(p, [0, 0.35], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <Img
        src={staticFile(SHOT)}
        style={{ width: 1920, height: 1080, display: "block" }}
      />
    </AbsoluteFill>
  );
};

export const Workbench: React.FC<{
  /** 三块区域各自的「线框 → 实景」进度 */
  left: number;
  mid: number;
  right: number;
}> = ({ left, mid, right }) => {
  const shell = Math.max(left, mid, right);
  if (shell <= 0.001) {
    return null;
  }

  return (
    <AbsoluteFill>
      <RegionReveal region={REGIONS.left} p={left} wipe="down" />
      <RegionReveal region={REGIONS.mid} p={mid} wipe="right" />
      <RegionReveal region={REGIONS.right} p={right} wipe="down" />

      <AbsoluteFill>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080">
          {/* 线框：实景一到就褪 */}
          {(
            [
              [REGIONS.left, left, 9],
              [REGIONS.mid, mid, 6],
              [REGIONS.right, right, 5],
            ] as [Region, number, number][]
          ).map(([r, p, rows]) => {
            const o = interpolate(p, [0, 0.15, 0.8], [0, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (o <= 0.001) {
              return null;
            }
            return (
              <g key={r.label} opacity={o}>
                <rect
                  x={r.x + 12}
                  y={r.y + 60}
                  width={r.w - 24}
                  height={r.h - 120}
                  rx={18}
                  fill="none"
                  stroke={WIRE}
                  strokeWidth={1.6}
                  strokeDasharray={WIRE_DASH}
                />
                {wireframeOf(r, rows)}
                <text
                  x={r.x + r.w / 2}
                  y={r.y + 40}
                  fill={COLORS.fgSecondary}
                  fontSize={22}
                  fontWeight={600}
                  fontFamily={FONT_FAMILY}
                  textAnchor="middle"
                  letterSpacing={4}
                >
                  {r.label}
                </text>
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
