import { Img, interpolate, spring, staticFile, useVideoConfig } from "remotion";
import { COLORS, FONT_FAMILY } from "../theme";
import { UI } from "./RecordingScreen";

/**
 * ⚠️ **本文件当前全片未引用**（审片局部 16）。
 * 录屏里点开弹层第一下选项就全在了，这块重绘的「依次落位」和它对不上，会穿帮，
 * 所以镜头 7 已经改成直接用录屏原样。文件留着是因为将来重录 G段 也许还用得上。
 *
 * 镜头 7 开头那一下「6 条 Agent 依次落位」（PLAN.md D2「G 段」最后一行）。
 *
 * 页面本身**没有**这个动画 —— 弹层是一次性整块落下的。
 * 手册里原本设想的「空列表 → 点刷新 → 图标降落」也不存在（`CHAT_AGENTS` 写死 6 条，
 * 点刷新拿同一个数组重建，画面上看不出变化），所以那条已作废，
 * 只把「依次落位」降级成**入场修饰**：录屏的弹层刚出现的那十几帧，
 * 用一块**不透明**的重绘弹层盖住它，让 6 条自己错落落下，落完就硬切回录屏。
 *
 * ⚠️ 为什么是硬切不是交叉淡出：重绘和录屏的字体渲染不可能像素级一致，
 * 淡出会看到一层文字残影；硬切只有一帧，而且切的那一帧镜头正在推，看不出来。
 * 盖住的区域底下本来就是纯白弹层，所以不透明覆盖没有色差。
 *
 * 几何全部来自 `UI.agent*`（量自 G段 2.6s）。要对位就只改那一处。
 */

const AGENTS: { name: string; icon: string; checked?: boolean }[] = [
  // 首项就是全片那枚 logo —— 落版、镜头 2 的形变目标、这里的 Agent 头像是同一个文件
  { name: "MS Insight Native", icon: "logo.png", checked: true },
  { name: "Pangu", icon: "agents/pangu-16.svg" },
  { name: "DeepSeek", icon: "agents/deepseek-32.svg" },
  { name: "GLM", icon: "agents/glm.svg" },
  { name: "Codex", icon: "agents/codex.svg" },
  { name: "Claude", icon: "agents/claude-32.svg" },
];

const ICON = 26;

export const AgentPopup: React.FC<{
  /** 本镜帧号（useShotFrame 的结果） */
  frame: number;
  /** 弹层落下的那一帧 */
  enter: number;
  /** 硬切回录屏的那一帧：>= 它就整块不渲染 */
  cutAt: number;
}> = ({ frame, enter, cutAt }) => {
  const { fps } = useVideoConfig();
  const f = frame - enter;
  if (frame < enter || frame >= cutAt) {
    return null;
  }

  // 弹层整体：顶边不动地展开，和真实 dropdown 一个手感
  const open = spring({ frame: f, fps, durationInFrames: 10, config: { damping: 200 } });

  return (
    <div
      style={{
        position: "absolute",
        left: UI.agentPopup.x,
        top: UI.agentPopup.y,
        width: UI.agentPopup.w,
        height: UI.agentPopup.h,
        background: "#FFFFFF",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        fontFamily: FONT_FAMILY,
        transformOrigin: "top center",
        transform: `scaleY(${interpolate(open, [0, 1], [0.86, 1])})`,
        opacity: interpolate(open, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: UI.agentTextX - UI.agentPopup.x - 41,
          top: 26,
          fontSize: 15,
          color: COLORS.fgSecondary,
        }}
      >
        切换 Agent
      </div>

      {AGENTS.map((agent, i) => {
        // 每条晚 2 帧，从上方 16px 落下
        const drop = spring({
          frame: f - 4 - i * 2,
          fps,
          durationInFrames: 14,
          config: { damping: 200 },
        });
        const cy = UI.agentRow0 + i * UI.agentRowPitch - UI.agentPopup.y;
        return (
          <div
            key={agent.name}
            style={{
              position: "absolute",
              left: UI.agentPill.x - UI.agentPopup.x,
              top: cy - UI.agentPill.h / 2,
              width: UI.agentPill.w,
              height: UI.agentPill.h,
              borderRadius: 10,
              background: agent.checked ? "rgba(67,105,239,0.08)" : "transparent",
              opacity: drop,
              transform: `translateY(${(1 - drop) * -16}px)`,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Img
              src={staticFile(agent.icon)}
              style={{
                position: "absolute",
                left: UI.agentIconX - UI.agentPill.x - ICON / 2,
                width: ICON,
                height: ICON,
              }}
            />
            <span
              style={{
                position: "absolute",
                left: UI.agentTextX - UI.agentPill.x,
                fontSize: 18,
                color: COLORS.fg,
              }}
            >
              {agent.name}
            </span>
            {agent.checked ? (
              <span
                style={{
                  position: "absolute",
                  left: UI.agentCheckX - UI.agentPill.x - 8,
                  fontSize: 18,
                  color: COLORS.blue,
                }}
              >
                ✓
              </span>
            ) : null}
          </div>
        );
      })}

      {/* 底部两个按钮：不做入场，跟着弹层一起在就行 */}
      {[
        { label: "添加 Agent", x: UI.agentBtns.ax },
        { label: "刷新", x: UI.agentBtns.bx },
      ].map((btn) => (
        <div
          key={btn.label}
          style={{
            position: "absolute",
            left: btn.x - UI.agentPopup.x,
            top: UI.agentBtns.y - UI.agentPopup.y,
            width: UI.agentBtns.w,
            height: UI.agentBtns.h,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            color: COLORS.fg,
            opacity: interpolate(f, [10, 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {btn.label}
        </div>
      ))}
    </div>
  );
};
