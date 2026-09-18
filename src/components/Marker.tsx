import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { BLUE_SHEEN, COLORS, FONT_FAMILY } from "../theme";

/**
 * 标注件。
 *
 * ⚠️ 审片意见「去除所有局部的画圈，只留标注」——
 * 原来的 `CircleMarker` 已经删掉：圈的位置永远画不准（界面元素会随行数、滚动位移），
 * 画歪了比不画更糟，而且手绘圈本身也不够高级。
 * 现在只剩一枚**蓝色圆角矩形标注**：底色是那道轻微的蓝渐变。
 *
 * ⚠️ v2 审片：「蓝色标注不需要箭头，统一圆角矩形」「有蓝色绿色标注，请统一用蓝色」——
 * 所以那枚 45° 小尖角已经删掉，圆角由 999（胶囊）收成 14（圆角矩形）；
 * `color` 参数留着但全片不再传，凡是标注一律是同一支蓝。
 * 「说的是这儿」靠的是**位置 + 从目标方向推出来的入场**，不靠画一根指针。
 *
 * ⚠️ 这些组件要放进 <CameraShot> 内部：标注是「贴在界面上」的，得跟着镜头一起推拉。
 * 屏幕字（ScreenLine）反过来，放在 CameraShot 外面。
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 入场 0→1、退场 1→0，合成一条不透明度曲线 */
const useLife = (frame: number, enter: number, exit?: number) => {
  const { fps } = useVideoConfig();
  const inn = spring({
    frame: frame - enter,
    fps,
    durationInFrames: 16,
    config: { damping: 200 },
  });
  const out =
    exit === undefined
      ? 1
      : interpolate(frame, [exit, exit + 10], [1, 0], clamp);
  return { inn, opacity: inn * out };
};

export type CalloutSide = "top" | "bottom" | "left" | "right";

/**
 * 一枚标注（圆角矩形）。
 *
 * `x/y` 是它**贴着**的那个点（画幅坐标），`side` 是它挂在这个点的哪一边。
 * 没有尖角、没有引线 —— 位置本身就说清了「说的是这儿」。
 */
export const Callout: React.FC<{
  frame: number;
  enter: number;
  exit?: number;
  /** 指向的点，画幅坐标 */
  x: number;
  y: number;
  /** 标注挂在这个点的哪一边 */
  side?: CalloutSide;
  /** 标注离那个点多远 */
  gap?: number;
  text: string;
  size?: number;
  /** 主色。不给就是全片那道蓝渐变 */
  color?: string;
}> = ({
  frame,
  enter,
  exit,
  x,
  y,
  side = "top",
  gap = 26,
  text,
  size = 26,
  color,
}) => {
  const { inn, opacity } = useLife(frame, enter, exit);
  if (opacity <= 0.001) {
    return null;
  }

  const background = color ?? BLUE_SHEEN;
  // 入场是「从指向的那个方向推出来」，比纯淡入更像「标出来的」
  const slide = (1 - inn) * 14;
  const box: React.CSSProperties =
    side === "top"
      ? { left: x, top: y - gap, transform: `translate(-50%,-100%) translateY(${-slide}px)` }
      : side === "bottom"
        ? { left: x, top: y + gap, transform: `translate(-50%,0) translateY(${slide}px)` }
        : side === "left"
          ? { left: x - gap, top: y, transform: `translate(-100%,-50%) translateX(${-slide}px)` }
          : { left: x + gap, top: y, transform: `translate(0,-50%) translateX(${slide}px)` };

  return (
    <div
      style={{
        position: "absolute",
        ...box,
        opacity,
        whiteSpace: "nowrap",
        fontFamily: FONT_FAMILY,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: 1,
        color: "#FFFFFF",
        background,
        padding: `${Math.round(size * 0.34)}px ${Math.round(size * 0.7)}px`,
        // 圆角矩形，不是胶囊（v2 全片 2）
        borderRadius: 14,
        // 上缘一道极细高光，色块才不是一块死色
        boxShadow:
          "0 8px 24px rgba(29,52,140,0.26), inset 0 1px 0 rgba(255,255,255,0.22)",
      }}
    >
      <span style={{ position: "relative" }}>{text}</span>
    </div>
  );
};

/**
 * 重点词提亮：一块圆角底 + 一条下划线，扫过去再淡掉。
 * 现在全片只剩镜头 7「一次点击三处同时换脸」那一处在用 ——
 * 镜头 3 输入框里那三处已按审片意见去掉（录屏自带内容就够了）。
 */
export const HighlightBox: React.FC<{
  frame: number;
  enter: number;
  /** 亮多久（帧）。到点自己淡掉，不用给 exit */
  hold?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
}> = ({ frame, enter, hold = 34, x, y, w, h, color = COLORS.blue }) => {
  const f = frame - enter;
  if (f < 0 || f > hold + 14) {
    return null;
  }
  // 底色刷过去：宽度先长出来，再整体淡掉
  const sweep = interpolate(f, [0, 9], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const fade = interpolate(f, [hold, hold + 14], [1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: x - 8,
        top: y - h / 2,
        width: (w + 16) * sweep,
        height: h,
        opacity: fade,
        borderRadius: 8,
        background: `${color}22`,
        borderBottom: `3px solid ${color}`,
        pointerEvents: "none",
      }}
    />
  );
};
