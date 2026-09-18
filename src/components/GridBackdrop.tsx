import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

/**
 * 极淡的网格底纹。镜头 1 的「过载感来自密度，不来自昏暗」靠它打底，
 * 镜头 2 工作台现形时整层褪掉。
 */
export const GridBackdrop: React.FC<{
  background: string;
  opacity?: number;
}> = ({ background, opacity = 1 }) => (
  <AbsoluteFill style={{ backgroundColor: background }}>
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `linear-gradient(${COLORS.border} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.border} 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
      }}
    />
  </AbsoluteFill>
);
