import { interpolate, spring, useVideoConfig } from "remotion";
import { BLUE_PURPLE_SHEEN, COLORS, FONT_FAMILY } from "../theme";

/**
 * 场景特性描述（分镜表最后一列的那句）。
 *
 * ⚠️ 审片意见「画面黑色大字的场景特性描述，统一放在画面左下角，
 * 用一个一直浮着的白卡承载，可以做点美观修饰」——
 * 所以这里不再是画面正中的黑色大字 + 柔白衬底，而是**左下角一张浮着的白卡**：
 * 白底 + 圆角 + 长投影，左缘一条**蓝 → 紫**的渐变竖条（v2 全片 1），文字左对齐。
 * ⚠️ 竖条用的是 BLUE_PURPLE_SHEEN，和标注（纯蓝 BLUE_SHEEN）**故意不一样**：
 * 这张卡是旁白的声音，标注才是指着界面说话的。
 * 常驻期间叠一条极缓的上下浮动，所以它是「浮着」的，不是贴死在角上。
 *
 * frame 由场景传进来（场景可能被包在 Sequence 里，组件自己取帧会错位）。
 */
export const ScreenLine: React.FC<{
  text: string;
  frame: number;
  /** 入场帧 */
  enter: number;
  /** 退场帧，不给就一直留着 */
  exit?: number;
  size?: number;
  color?: string;
}> = ({ text, frame, enter, exit, size = 42, color = COLORS.fg }) => {
  const { fps } = useVideoConfig();
  const rise = spring({
    frame: frame - enter,
    fps,
    durationInFrames: 22,
    config: { damping: 200 },
  });
  const out =
    exit === undefined
      ? 1
      : interpolate(frame, [exit, exit + 12], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const opacity = rise * out;
  if (opacity <= 0.001) {
    return null;
  }

  // 一直浮着：4 秒一个来回、±3px，慢到不抢戏，又不至于像贴纸
  const float = Math.sin(((frame - enter) / (fps * 4)) * Math.PI * 2) * 3;

  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        bottom: 88,
        opacity,
        // 入场从左边滑进来
        transform: `translateX(${(1 - rise) * -46}px) translateY(${float}px)`,
        display: "flex",
        alignItems: "stretch",
        background: "#FFFFFF",
        borderRadius: 18,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 18px 44px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)",
        overflow: "hidden",
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* 左缘那道竖条 —— 上蓝下紫 */}
      <div style={{ width: 6, background: BLUE_PURPLE_SHEEN, flexShrink: 0 }} />
      <div
        style={{
          padding: `${Math.round(size * 0.56)}px ${Math.round(size * 0.96)}px`,
          fontSize: size,
          fontWeight: 600,
          letterSpacing: 2,
          lineHeight: 1.25,
          color,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};
