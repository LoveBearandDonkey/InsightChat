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
import { COLORS } from "../theme";
import { SHOTS } from "../shots";

/**
 * 镜头 4 ｜ 0:18–0:21 ｜ 发问
 *
 * 素材：还是 `public/A段.mp4`，接着镜头 3 那一帧往下播（12.50–15.50s）——
 * 手册说的「发送后继续录 5 秒」就是为了这一镜。两镜之间是硬切，
 * 但因为是同一条连拍，剪出来是完全连续的一段，观众看不到刀口。
 *
 * 节拍（30fps）：
 *   0–30    问题卡片吸顶、4 行自动夹成 3 行，右侧折叠箭头出现
 *   30–60   标题栏下冒出会话主题行；输入框 SVG 描边跑马流光点亮
 *   60–90   消息区上滚，思考块第一个节点亮起（接镜头 5 的重绘竖轨）
 *
 * 镜头只有一条：从卡片吸顶的位置慢慢往下让，把主题行和思考块让进画面。
 * 三秒的镜头别再切段，切了就碎。
 *
 * ⚠️ 审片意见：圈全部去掉，只留标注（全片 1）；构图跟着镜头 3 一起右移（局部 12）。
 * ⚠️ v2 局部 10：「会话主题」那条标注**溢出了画面顶边**，因为它进场时镜头已经下摇。
 *   现在两条标注一起在 6–36 帧出完，那时镜头还在 CAM_IN，主题行还在画幅里。
 *   （60 帧那个「消息区上滚」的节拍不再需要常量，节拍表留在上面对着录屏核就行。）
 */

/** 本镜第 0 帧对应 A段 里的第几秒（= 镜头 3 的末帧） */
const A_START = 12.5;

const TITLE = 30;

/** 和镜头 3 同一套 lens 参数，两镜是同一条连拍，构图必须一致（v2 局部 9 一起改） */
const P = lens(1.28, 300, 20);
const CAM_IN = P(1.34, 1470, 430);
const CAM_OUT = P(1.28, 1470, 530);

export const Shot4Ask: React.FC = () => {
  const f = useShotFrame(3);
  // 3 → 4 是硬切，前面没有转场借帧；写上是为了跟其它镜一个写法
  const pad = useShotPad(3);
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      <CameraSegment
        from={0}
        durationInFrames={durationInFrames}
        cam={{ from: CAM_IN, to: CAM_OUT }}
      >
        <RecordingScreen src="A段.mp4" startSeconds={A_START - pad / 30}>
          {/* 两条标注**同时**出现在 6–36 帧（v2 局部 10）。
              上一版「会话主题」是帧 34 才进场的，那时镜头已经下摇到 focusY=530，
              主题行本身跑到画幅 y≈−18 —— 标注自然跟着溢出画顶。
              现在两条都趁镜头还在 CAM_IN（主题行在 y≈90）时出完，一左一右不打架。 */}
          <Callout
            frame={f}
            enter={6}
            exit={TITLE + 6}
            x={UI.askCard.x}
            y={UI.askCard.y + UI.askCard.h / 2}
            side="left"
            text="提问吸顶 · 锚点跟着走"
          />

          {/* 会话主题行是从第一问自动派生的，不是用户起的名 */}
          <Callout
            frame={f}
            enter={9}
            exit={TITLE + 6}
            x={UI.sessionTitle.x + UI.sessionTitle.w}
            y={UI.sessionTitle.y + UI.sessionTitle.h / 2}
            side="right"
            text="会话主题自动派生"
          />
        </RecordingScreen>
      </CameraSegment>

      <ScreenLine text={SHOTS[3].screen} frame={f} enter={10} exit={78} />
    </AbsoluteFill>
  );
};
