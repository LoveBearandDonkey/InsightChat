import { AbsoluteFill, useVideoConfig } from "remotion";

import { Callout } from "../components/Marker";
import {
  CameraSegment,
  lens,
  RecordingScreen,
  UI,
} from "../components/RecordingScreen";
import { ScreenLine } from "../components/ScreenLine";
import { useShotFrame, useShotPad } from "../components/useShotFrame";
import { SHOTS } from "../shots";
import { COLORS } from "../theme";

/**
 * 镜头 3 ｜ 0:10–0:18 ｜ 把整个采集目录带进对话
 *
 * 素材：`public/A段.mp4`（Ctrl+Shift+Enter 触发的内置脚本，一条 take 到底）。
 * 实测源里的时间点（**不是** PLAN.md 手册那份「按下快捷键算 0」的相对表，
 * 那份表没算上按快捷键之前的准备时间）：
 *   2.20s 对话面板打开     5.60s 开始打「帮我诊断」   5.85s 上下文选择框弹出
 *   6.80s 蓝胶囊落定       9.60s 第 2 行打完          10.78s 第 3 行打完
 *   11.90s 第 4 行打完     12.40s 点发送
 * 本镜取 A段 4.50–12.50s，正好 8 秒，末帧刚过发送 —— 镜头 4 接着同一条 take 往下播，
 * 两镜之间是硬切（shots.ts 里 transitionAfter: null），实际是**同一条连拍**，接缝天然。
 *
 * 节拍（30fps，帧号 = 分镜细表的时间码 × 30）：
 *   0–39     锚定 chip 亮出那句 tooltip
 *   39–108   敲 `#` → 选择框往上开 → 回车落成蓝胶囊
 *   108–222  补完剩下三行
 *   222–240  点发送，镜头压向发送键
 *
 * ⚠️ 审片意见落在这里：
 *   局部 11｜删掉「一个 # 带走 8 张卡」那条标注。
 *   局部 13｜删掉输入框里三处蓝色高亮标签 —— 录屏自带内容就够了，不额外修饰。
 *   局部 12｜**输入框要往画面中间靠**。对话面板贴着屏幕右缘，光靠推近永远把它顶在最右侧；
 *          现在 lens 带 bleedX，右侧允许推出录屏之外，露出的白底正是录屏卡的圆角边（见 RecordingScreen）。
 *   v2 局部 8｜chip 那条标注改成「当前对话自然锚定任务」。
 *   v2 局部 9｜再往中间挪一档，并且**修掉真正的溢出**（在纵向，见下面 CAM_* 那段注释）。
 *
 * 0–39 那句 tooltip 原文本来抄的是 chat.html，v2 审片改成更短的一句，照改。
 *
 * 结构照 D4 的坑 ②：画面是纯组件，帧号外面算好传进去，每段运镜各套一层 CameraShot；
 * 每段的 startSeconds 也跟着段首重算 —— Sequence 会重置 useCurrentFrame，
 * 而 trimBefore 是相对本段第 0 帧的。
 */

/** 本镜第 0 帧对应 A段 里的第几秒 */
const A_START = 4.5;

const PICK = 39;
const TYPE = 108;
const SEND = 222;
const END = 240;

/**
 * 本镜的镜头：safeScale = 全镜最小 scale，bleedX / bleedY = 右侧、下沿允许出画多少画幅 px。
 * 三个数一镜一套，段边界复用同一个姿态常量就一定接得上。
 *
 * ⚠️ v2 局部 9：输入框再往画面中间挪一档，并且**不许再溢出画幅底边**。
 * focusX 1400 → 1470（输入框中心从画幅 x≈1216 挪到 ≈1123，58.5% 处）；
 * focusY 690 → 736（输入框底边由 y≈1084「被切掉一条」变成 y≈1022，留 58px 余量）。
 * 736 是 `1140 − 540/1.34` 算出来的上限：等号成立时录屏底边正好压在画幅底边，
 * 一个白像素都不露；再大就要露白杠了。bleedY=20 就是为了放开这 20px。
 */
const P = lens(1.28, 300, 20);
const CAM_CHIP = P(1.44, 1470, 718);
const CAM_CHIP_END = P(1.4, 1470, 714);
const CAM_PICKER = P(1.28, 1470, 585);
const CAM_TYPING = P(1.34, 1470, 736);
const CAM_SEND = P(1.4, 1470, 730);

export const Shot3Context: React.FC = () => {
  const f = useShotFrame(2);
  // <Sequence from> 吃的是原始帧：本镜前面被 2→3 那一刀 flip 借走了半个转场
  const pad = useShotPad(2);
  const { durationInFrames } = useVideoConfig();

  /** fromShotFrame = 本段第 0 帧在分镜时间轴上的位置（第一段是 -pad） */
  const clip = (fromShotFrame: number, children?: React.ReactNode) => (
    <RecordingScreen src="A段.mp4" startSeconds={A_START + fromShotFrame / 30}>
      {children}
    </RecordingScreen>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      {/* 0–39：几乎不动，把注意力全留给 chip 上那句 tooltip。
          tooltip 原文抄 chat.html，别自己编 */}
      <CameraSegment
        from={0}
        durationInFrames={pad + PICK}
        cam={{ from: CAM_CHIP, to: CAM_CHIP_END }}
      >
        {clip(
          -pad,
          <Callout
            frame={f}
            enter={4}
            exit={PICK - 6}
            x={UI.chip.x}
            y={UI.chip.y + UI.chip.h / 2}
            side="left"
            text="当前对话自然锚定任务"
          />,
        )}
      </CameraSegment>

      {/* 39–108：拉开一点，让往上开的选择框整个进画。这一段不加任何标注 */}
      <CameraSegment
        from={pad + PICK}
        durationInFrames={TYPE - PICK}
        cam={{ from: CAM_CHIP_END, to: CAM_PICKER }}
      >
        {clip(PICK)}
      </CameraSegment>

      {/* 108–222：输入框随行数长高，镜头跟着慢慢压回来。
          录屏自己在打字，不要再往上叠高亮标签 */}
      <CameraSegment
        from={pad + TYPE}
        durationInFrames={SEND - TYPE}
        cam={{ from: CAM_PICKER, to: CAM_TYPING }}
      >
        {clip(TYPE)}
      </CameraSegment>

      {/* 222–240：压向发送键，接住源里那圈变色涟漪 */}
      <CameraSegment
        from={pad + SEND}
        durationInFrames={durationInFrames - pad - SEND}
        cam={{ from: CAM_TYPING, to: CAM_SEND }}
      >
        {clip(SEND)}
      </CameraSegment>

      {/* 场景特性描述不跟镜头动，所以留在 CameraShot 外面（左下角那张浮卡） */}
      <ScreenLine text={SHOTS[2].screen} frame={f} enter={10} exit={END - 52} />
    </AbsoluteFill>
  );
};
