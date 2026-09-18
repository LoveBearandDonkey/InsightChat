import { AbsoluteFill } from "remotion";

import { Callout } from "../components/Marker";
import {
  CameraSegment,
  lens,
  RecordingScreen,
  UI,
} from "../components/RecordingScreen";
import { ScreenLine } from "../components/ScreenLine";
import { ThinkTrack } from "../components/ThinkTrack";
import { useShotFrame, useShotPad } from "../components/useShotFrame";
import { COLORS } from "../theme";

/**
 * 镜头 5 ｜ 0:21–0:31 ｜ 推理可见 + 反向定位（对话 → 图）
 *
 * **全片主镜。**前半讲「可监督、可举证」，后半讲「双向可达」。
 * 分镜细表的备注写得很死：宁可砍两个思考节点，也要把点锚点那 2.5 秒拍足 —— 这里照办。
 *
 * 三种素材接力，两处硬切都在「画面结构刚好换一茬」的位置上：
 *   0–118    思考竖轨：**JSX 重绘**（见 ThinkTrack.tsx，源里这段 18 秒，压不进 4 秒）
 *   118–136  「思考完成 9m24s」整块向上合拢 —— 收起这个动作本身就是一句话
 *   136–225  报告流式：C段 37.15s 起、1.15 倍速。折叠条那一行是硬切两端共同的锚点
 *   225–300  反向定位：D+E段 5.90s 起、1.16 倍速（源里 6.20s 点锚点、6.6s 展开完）
 *
 * D+E段 是一条连拍，**镜头 6 接着 8.80s 往下播**，中间不插转场也不变焦 ——
 * 「一去一回」靠的就是同一个镜位连着走。
 *
 * ⚠️ 审片意见落在这里：
 *   全片 4｜**太多正视角**。思考滚屏这 4.8 秒本来是全片最正、最平的一段，
 *          现在给它一个从左偏到右偏的缓慢转动（rotateY -9 → 5），画面才活。
 *          旋转期间靠 scale 1.16 兜底，四角不会露出画幅外。
 *   全片 1｜圈全部去掉，只留标注。原来报告段那个「只有圈、没有标注」的记号直接删了 ——
 *          圈没了它就什么都不剩，而屏幕字已经说过这件事。
 *   局部 12｜lens 带 bleedX，构图和镜头 3/4/6 一致。
 */

/**
 * 7 个节点的节拍。
 * ⚠️ v2 局部 11：「这一部分 4 秒也太多了，加快到 3 秒」——
 * 竖轨整段由 165 帧压到 136 帧（含合拢），省下的 29 帧全给下面的报告流式段，
 * 报告那段由 2 秒变成 3 秒，正好补上「读不完」。
 */
const NODE_BEATS: [number, number][] = [
  [0, 12],
  [12, 26],
  [26, 38],
  [38, 52],
  // 节点 5、6 是「证伪」那两步，全片最能说明它在推理而不是背答案，各停得比别人久
  [52, 76],
  [76, 100],
  [100, 115],
];
const COLLAPSE_START = 118;
const COLLAPSE_END = 136;

const REPORT = 136;
const LOCATE = 225;
const PAN = 246;
const SETTLE = 276;
const END = 300;

/** 报告段：C段 里「思考完成 9m24s ›」+ 结论速览刚开始吐的那一帧 */
const C_START = 37.15;
const C_RATE = 1.15;
/** 反向定位段：D+E段 里光标正要挪向锚点的那一帧 */
const DE_START = 5.9;
const DE_RATE = 1.16;
/** 镜头 6 接着播的位置，改这里要同步改 Shot6Backflow */
export const DE_HANDOFF = DE_START + ((END - LOCATE) / 30) * DE_RATE;

/** 和镜头 3/4/6 同一套 lens 参数（v2 局部 9：右移一档 + 放开 20px 下沿） */
const P = lens(1.3, 300, 20);
const CAM_REPORT_IN = P(1.34, 1470, 470);
const CAM_REPORT_OUT = P(1.3, 1470, 600);
const CAM_ANCHOR = P(1.36, 1470, 700);
const CAM_CHART = P(1.3, 900, 640);
/** 本镜末帧的姿态 = 镜头 6 的起手姿态 */
export const CAM_FREE_ROW = P(1.34, 860, 645);

export const Shot5Reasoning: React.FC = () => {
  const f = useShotFrame(4);
  // 4 → 5 是硬切，没有借帧；保留写法以防以后改成转场
  const pad = useShotPad(4);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      {/* 0–136：JSX 重绘的思考竖轨，装在一张对话面板里。
          镜头做一次从左到右的缓慢转动 —— 全片正视角太多，这一段最该动（审片全片 4）。
          内容自己往上滚，所以运镜只给「视角」，不再叠推拉。 */}
      <CameraSegment
        from={0}
        durationInFrames={pad + REPORT}
        cam={{
          from: { scale: 1.16, focusY: 52, rotateY: -9, rotateX: 2 },
          to: { scale: 1.12, focusY: 48, rotateY: 5, rotateX: 0 },
        }}
      >
        <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
          <ThinkTrack
            frame={f}
            beats={NODE_BEATS}
            collapseStart={COLLAPSE_START}
            collapseEnd={COLLAPSE_END}
          />
        </AbsoluteFill>
      </CameraSegment>

      {/* 136–225：切到真素材（比上一版多整整 1 秒，报告读得完了）。第一条「性能健康度 75 / 100」打完停半拍，
          回扣镜头 1 那只停在 75 的表 —— 两处是同一个数，别改。
          这一段不加标注：录屏自己在流式吐字，是全片最不该被打断的一段 */}
      <CameraSegment
        from={pad + REPORT}
        durationInFrames={LOCATE - REPORT}
        cam={{ from: CAM_REPORT_IN, to: CAM_REPORT_OUT }}
      >
        <RecordingScreen src="C段.mp4" startSeconds={C_START} playbackRate={C_RATE} />
      </CameraSegment>

      {/* 225–246：光标挪向第三条结论末尾的锚点 ⌖ 图上看 Free 轨 */}
      <CameraSegment
        from={pad + LOCATE}
        durationInFrames={PAN - LOCATE}
        cam={{ from: CAM_ANCHOR, to: CAM_ANCHOR }}
      >
        <RecordingScreen
          src="D+E段.mp4"
          startSeconds={DE_START}
          playbackRate={DE_RATE}
        >
          <Callout
            frame={f}
            enter={LOCATE + 2}
            exit={PAN - 4}
            x={UI.anchorBtn.x}
            y={UI.anchorBtn.y + UI.anchorBtn.h / 2}
            side="left"
            text="点结论，回到图上"
          />
        </RecordingScreen>
      </CameraSegment>

      {/* 246–276：镜头顺势左摇回泳道图。摇镜、分组自动展开、Free 行滚到中间三件事同步走，
          看起来就像「对话把你的视线牵过去」。全片少数几处该开运动模糊的地方 */}
      <CameraSegment
        from={pad + PAN}
        durationInFrames={SETTLE - PAN}
        blur
        cam={{ from: CAM_ANCHOR, to: CAM_CHART }}
      >
        <RecordingScreen
          src="D+E段.mp4"
          startSeconds={DE_START + ((PAN - LOCATE) / 30) * DE_RATE}
          playbackRate={DE_RATE}
        />
      </CameraSegment>

      {/* 276–300：落在展开后的 Overlap Analysis 上，Free 那一行闪定位高亮。
          末帧姿态交给镜头 6，同一个镜位连着走 */}
      <CameraSegment
        from={pad + SETTLE}
        durationInFrames={END - SETTLE}
        cam={{ from: CAM_CHART, to: CAM_FREE_ROW }}
      >
        <RecordingScreen
          src="D+E段.mp4"
          startSeconds={DE_START + ((SETTLE - LOCATE) / 30) * DE_RATE}
          playbackRate={DE_RATE}
        >
          <Callout
            frame={f}
            enter={SETTLE + 6}
            exit={END - 8}
            x={UI.freeRow.x + UI.freeRow.w / 2}
            y={UI.freeRow.y + UI.freeRow.h}
            side="bottom"
            text="折叠分组自动展开 · 定位闪光"
          />
        </RecordingScreen>
      </CameraSegment>

      {/* 左下角浮卡分两句：前半「可追溯」，后半「双向可达」 */}
      <ScreenLine
        text="它查了什么、排除了什么，一步步摊开"
        frame={f}
        enter={12}
        exit={112}
      />
      <ScreenLine
        text="关键结论，能点回到图上"
        frame={f}
        enter={244}
        exit={END - 10}
      />
    </AbsoluteFill>
  );
};
