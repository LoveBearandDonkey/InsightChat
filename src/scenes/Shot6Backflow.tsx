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
import { CAM_FREE_ROW, DE_HANDOFF } from "./Shot5Reasoning";

/**
 * 镜头 6 ｜ 0:31–0:37 ｜ 图 → 对话，以及不打断的节奏
 *
 * 和镜头 5 是一对：上一镜刚从对话定位到图上，这一镜就从图上把东西丢回对话。
 * 所以前 2.8 秒**接着 D+E段 那条连拍往下播**（8.80s 起），镜位、焦距、光标位置全都是连的 ——
 * shots.ts 里 5 的 transitionAfter 是 null，剪辑上也不许在两镜之间插转场。
 *
 * 节拍（30fps），D+E段 里实测的时间点。
 * ⚠️ v2 局部 12：「32~34 秒太快了，1 秒闪现 2 个蓝色提示，完全没有时间看，延长 1 秒」——
 * 上一版右键（f=41）→ 点击（f=66）→ 切走（f=84）只有 1.4 秒，两条标注挤在里头。
 * 现在**一镜三速**：光标空跑那段快放腾出时间，右键到拖影那段**慢放到 0.84~0.9 倍**，
 * 同一段动作摊开成 2.2 秒，两条标注各有一秒的独立停留。
 *   0–30     快放 1.60×：光标从 Free 行挪到算子条上（源 8.80 → 10.40s）
 *   30–64    慢放 0.84×：右键菜单弹出、看清第一组两项（源 10.40 → 11.35s）
 *   64–96    慢放 0.90×：点「智能分析」→ 拖影飞进输入框（**本镜的哇点，开运动模糊**）
 *   96–108   切 F段 4.80s：回车落成排队卡片，头部「1 条排队消息」
 *   108–188  切 F段 12.10s、1.15×：**第二条从打字开始**看得见 → 回车 → 计数跳 2 → 收起
 *
 * ⚠️ 审片意见（v1 局部 15）：第二条必须从**打字**开始，否则观众会以为
 * 「右键置入就会马上变出两条队列消息」。
 * ⚠️ 12.10s 这个数是按「13.90s 回车」往前推 1.8s 估的，**出片前拿 F段 逐帧再校一次**：
 * 要的是「光标已经在输入框里、字正在往外冒」那一帧；若那会儿还在滚上一轮的字，就再往后挪。
 *
 * ⚠️ 分镜细表最后还有一拍「往回上滚 → 输入框上方浮出跳动三个点的气泡 → 一键置底」，
 * **F段 里没录到**（整段都在跟着流式自动置底，气泡始终没触发）。
 * 这里不编一个假的，改成把「队列收起只剩一行」这一拍拍足收尾。
 */

/** 右键菜单弹出（源 10.40s） */
const MENU = 30;
/** 点「智能分析」（源 11.35s） */
const PICK = 64;
/** 切 F段：回车 → 「1 条排队消息」 */
const QUEUE_1 = 96;
/** 第二条队列消息的段首 —— 从**打字**开始，不是从回车开始 */
const QUEUE_2 = 108;

/**
 * D+E段 在本镜的三档倍速（源 60fps，慢放不掉帧、很干净）。
 * 每段的入点直接写源里的秒数，不再由一个统一 rate 推算 —— 一镜三速，推算反而容易错。
 */
const DE_RATE_LEAD = 1.6;
const DE_MENU_AT = 10.4;
const DE_RATE_MENU = 0.84;
const DE_PICK_AT = 11.35;
const DE_RATE_DROP = 0.9;

/** F段：4.83s 排队卡片弹出。从 4.80 切进去，卡片正好在刀口上冒出来，输入框里的旧文本来不及被看见 */
const F_QUEUE_1 = 4.8;
/** F段：13.90s 第二条回车、14.95s 点箭头收起。从 12.10s 切进去，打字过程完整可见 */
const F_QUEUE_2 = 12.1;
/** 80 帧要装下 12.10 → 15.17s（打字 → 回车 → 计数跳 2 → 收起），所以补一点点快放 */
const F_RATE_2 = 1.15;

/** 和镜头 3/4/5 同一套 lens 参数：输入框要靠画面中间一点（v1 局部 12 / v2 局部 9） */
const P = lens(1.28, 300, 20);
const CAM_TO_LANE = P(1.28, 980, 690);
const CAM_MENU = P(1.28, 1010, 700);
const CAM_INPUT = P(1.36, 1470, 730);
const CAM_QUEUE = P(1.34, 1470, 730);
const CAM_END = P(1.3, 1450, 672);

export const Shot6Backflow: React.FC = () => {
  const f = useShotFrame(5);
  const pad = useShotPad(5);
  // 6 → 7 有一个 slide 转场，末段要一直铺到本镜末尾
  const { durationInFrames } = useVideoConfig();

  /**
   * 「算子名 · 耗时 自动带上」这条标注**跨着 96 帧那一刀**（D+E段 → F段）。
   * 两段各渲染一枚、参数完全一样，看起来就是连着的一条 ——
   * 底下换了素材，但界面版面和 UI 坐标是同一套，标注的落点不会动。
   */
  const droppedCallout = (
    <Callout
      frame={f}
      enter={PICK + 6}
      exit={QUEUE_1 + 6}
      x={UI.droppedText.x + UI.droppedText.w / 2}
      y={UI.droppedText.y}
      side="top"
      text="算子名 · 耗时 自动带上"
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      {/* 0–30：接着上一镜的落点拍，镜头还停在刚展开的 Overlap Analysis 上。
          光标空跑这一段快放，把时间省给后面两拍 */}
      <CameraSegment
        from={0}
        durationInFrames={pad + MENU}
        cam={{ from: CAM_FREE_ROW, to: CAM_TO_LANE }}
      >
        <RecordingScreen
          src="D+E段.mp4"
          startSeconds={DE_HANDOFF - (pad / 30) * DE_RATE_LEAD}
          playbackRate={DE_RATE_LEAD}
        />
      </CameraSegment>

      {/* 30–64：右键菜单。**慢放 0.84×**，第一组两项带 Agent 小图标，看得清再点 */}
      <CameraSegment
        from={pad + MENU}
        durationInFrames={PICK - MENU}
        cam={{ from: CAM_TO_LANE, to: CAM_MENU }}
      >
        <RecordingScreen
          src="D+E段.mp4"
          startSeconds={DE_MENU_AT}
          playbackRate={DE_RATE_MENU}
        >
          <Callout
            frame={f}
            enter={MENU + 4}
            exit={PICK - 2}
            x={UI.ctxMenuAnalyze.x + UI.ctxMenuAnalyze.w / 2}
            y={UI.ctxMenuAnalyze.y + UI.ctxMenuAnalyze.h}
            side="bottom"
            text="图上看到可疑的，右键丢进来"
          />
        </RecordingScreen>
      </CameraSegment>

      {/* 64–96：拖影从那根色块飞进输入框。算子名和耗时是从色块的 data-op / data-dur
          自动填的，录到什么就是什么 —— 分镜只锁格式，不锁具体值 */}
      <CameraSegment
        from={pad + PICK}
        durationInFrames={QUEUE_1 - PICK}
        blur
        cam={{ from: CAM_MENU, to: CAM_INPUT }}
      >
        <RecordingScreen
          src="D+E段.mp4"
          startSeconds={DE_PICK_AT}
          playbackRate={DE_RATE_DROP}
        >
          {droppedCallout}
        </RecordingScreen>
      </CameraSegment>

      {/* 96–108：换 F段。回车 —— 上一轮还在滚字，所以它不打断，落成排队卡片 */}
      <CameraSegment
        from={pad + QUEUE_1}
        durationInFrames={QUEUE_2 - QUEUE_1}
        cam={{ from: CAM_INPUT, to: CAM_QUEUE }}
      >
        <RecordingScreen src="F段.mp4" startSeconds={F_QUEUE_1}>
          {droppedCallout}
        </RecordingScreen>
      </CameraSegment>

      {/* 108–末尾：第二条**从打字开始**：敲字 → 回车 → 计数跳「2 条排队消息」→
          点左上角箭头，卡片向后退、向下坠、底边被输入框盖住，版面上只剩一行 */}
      <CameraSegment
        from={pad + QUEUE_2}
        durationInFrames={durationInFrames - pad - QUEUE_2}
        cam={{ from: CAM_QUEUE, to: CAM_END }}
      >
        <RecordingScreen
          src="F段.mp4"
          startSeconds={F_QUEUE_2}
          playbackRate={F_RATE_2}
        >
          <Callout
            frame={f}
            enter={148}
            exit={170}
            x={UI.queueHead.x}
            y={UI.queueHead.y + UI.queueHead.h / 2}
            side="left"
            text="不用等它答完，它替你排好队"
          />
        </RecordingScreen>
      </CameraSegment>

      {/* 镜头 5.5 那句（v2 全片 4 新加的一行）：31~33s，讲的是「传送」这个动作本身 */}
      <ScreenLine
        text="遇到可疑内容，传送到对话框"
        frame={f}
        enter={2}
        exit={58}
      />
      <ScreenLine text={SHOTS[5].screen} frame={f} enter={100} exit={172} />
    </AbsoluteFill>
  );
};
