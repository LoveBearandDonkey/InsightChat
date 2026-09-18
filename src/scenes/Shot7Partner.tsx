import { AbsoluteFill, useVideoConfig } from "remotion";

import { CameraPose } from "../components/CameraShot";
import { Callout, HighlightBox } from "../components/Marker";
import { CameraSegment, RecordingScreen, UI } from "../components/RecordingScreen";
import { ScreenLine } from "../components/ScreenLine";
import { useShotFrame, useShotPad } from "../components/useShotFrame";
import { COLORS } from "../theme";
import { SHOTS } from "../shots";

/**
 * 镜头 7 ｜ 0:37–0:40.5 ｜ 换个搭档
 *
 * 分镜细表原本写的是「点开弹层（空）→ 点刷新 → 图标依次降落」，
 * **那个行为页面上不存在**（见 D2「G 段」的作废说明）。实拍改成一条更硬的动作链：
 * 点品牌行 → 弹层落下 → 点 DeepSeek → `applyAgentIdentity()` 一次性换掉三处身份
 * （品牌行 / 欢迎页头像 / 底部模型按钮）→ 再进模型弹层挑一个该 Agent 自己的型号。
 * 讲的事比「刷新降落」更硬：换的不是名字，是整套身份。
 *
 * ⚠️ 审片意见（局部 16）：原来弹层刚落下的十几帧上盖了一块 JSX 重绘的弹层，
 * 让 6 条 Agent「依次落位」。**穿帮了** —— 录屏里点开第一下选项就全在了，
 * 重绘的落位和它对不上。这一拍现在直接用录屏原样，不再盖任何东西。
 * （`AgentPopup.tsx` 文件留着，以后重录 G段 也许还用得上，但全片不再引用。）
 *
 * ⚠️ 本镜由 4s 压到 3.5s（105 帧），省下的 0.5s 给镜头 8 的「答完停住」（审片局部 17）。
 * 压缩全部落在模型弹层那一段：倍速 1.15 → 1.45，节拍相应前移。
 *
 * 节拍（30fps），G段 里实测的时间点：
 *   0–30    源 1.35s 起。光标挪到品牌行，1.90s 弹层落下
 *   30–60   源 2.35s 起、1.05 倍速。光标下移到 DeepSeek，3.40s 按下（= 帧 60）
 *   60–68   三处同时换脸。镜头几乎正过来，先咬住品牌行和欢迎页头像
 *   68–78   顺着面板**竖直摇到底**（纵向平移，见 D5 坑①），落在模型按钮上 —— 它也换了
 *   78–92   切源 7.95s、1.45 倍速：模型弹层展开，列的是 DeepSeek 自己的 models
 *   92–末   切源 9.28s：选中 DeepSeek-V3.1，按钮文字跟着变
 *
 * ⚠️ 78 帧那一刀跨了 4.07s → 7.95s（中间是重开弹层的废镜头），光标位置会跳一下。
 * 故意压在摇镜的落点上：镜头正在动，跳不出来。
 *
 * ⚠️ v2 局部 13：删掉「欢迎页头像跟着改」和「连可选型号都跟着走」两条标注。
 * 三处换脸靠画面自己说 —— 一次点击同时改三处，本来就是看得见的，不用三条字幕陪着念。
 * 品牌行那一下 `HighlightBox` 留着：它不是标注，是「这里变了」的提亮。
 */

const PICK_AGENT = 60;
const WHIP = 68;
const MODEL_OPEN = 78;
const MODEL_PICK = 92;

/** 源里的时间点（秒）。段与段首尾相接的地方直接用上一段的终点，别各算各的 */
const G_START = 1.35;
const G_RATE2 = 1.05;
const G_SWAP = 3.4;
const G_MODEL = 7.95;
/** 1.15 → 1.45：本镜压掉的那 0.5s 全在这儿 */
const G_MODEL_RATE = 1.45;
const G_PICK = 9.28;

/**
 * 本镜的镜头姿态。**没走 pose()/lens()** —— 那套夹取假设 rotateY = 0，
 * 而这一镜前半是侧视角：一旋转，远端会被透视压扁，`960/s` 那个安全区就不够了。
 * 下面这几组是按「录屏四角投影后仍要盖住整幅」逐个验过的，改任何一个数都要重验。
 */
const at = (scale: number, x: number, y: number, rotateY = 0): CameraPose => ({
  scale,
  focusX: (x / 1920) * 100,
  focusY: (y / 1080) * 100,
  rotateY,
});

/** 侧视角起手：面板占右侧，先看得见品牌行 */
const CAM_IN = at(1.26, 1232, 470, -14);
/** 弹层落下后咬住整块弹层 */
const CAM_POPUP = at(1.62, 1300, 340, -12);
/** 光标下移期间极慢地再压近一点，制造「要按下去了」的预期 */
const CAM_PICK = at(1.68, 1310, 320, -10);
/** 换脸瞬间镜头基本正过来，同时看得见品牌行和欢迎页头像 */
const CAM_SWAP = at(1.6, 1300, 320, -6);
/** 摇到底：模型按钮 */
const CAM_MODELROW = at(1.55, 1290, 785);
/** 模型弹层展开，框住弹层 + 按钮 */
const CAM_MODEL = at(1.42, 1235, 752);
/** 选完退开半档收尾，交给 fade 转场 */
const CAM_END = at(1.3, 1175, 718);

export const Shot7Partner: React.FC = () => {
  const f = useShotFrame(6);
  const pad = useShotPad(6);
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      {/* 0–30：光标到品牌行 → 弹层落下。录屏原样，不再盖重绘弹层（审片局部 16） */}
      <CameraSegment
        from={0}
        durationInFrames={pad + 30}
        cam={{ from: CAM_IN, to: CAM_POPUP }}
      >
        <RecordingScreen src="G段.mp4" startSeconds={G_START - pad / 30} />
      </CameraSegment>

      {/* 30–60：光标从首项一路下到 DeepSeek。标注提前 8 帧出来，观众先知道要点哪 */}
      <CameraSegment
        from={pad + 30}
        durationInFrames={PICK_AGENT - 30}
        cam={{ from: CAM_POPUP, to: CAM_PICK }}
      >
        <RecordingScreen
          src="G段.mp4"
          startSeconds={G_START + 1}
          playbackRate={G_RATE2}
        >
          <Callout
            frame={f}
            enter={38}
            exit={PICK_AGENT - 4}
            x={UI.agentPill.x}
            y={UI.agentRow0 + 2 * UI.agentRowPitch}
            side="left"
            text="换个搭档"
          />
        </RecordingScreen>
      </CameraSegment>

      {/* 60–68：一次点击，三处同时换脸。先咬住上面两处 —— 品牌行的名字、欢迎页的头像 */}
      <CameraSegment
        from={pad + PICK_AGENT}
        durationInFrames={WHIP - PICK_AGENT}
        cam={{ from: CAM_PICK, to: CAM_SWAP }}
      >
        <RecordingScreen src="G段.mp4" startSeconds={G_SWAP}>
          <HighlightBox
            frame={f}
            enter={PICK_AGENT + 1}
            hold={16}
            x={UI.brandRow.x}
            y={UI.brandRow.y + UI.brandRow.h / 2}
            w={UI.brandRow.w}
            h={UI.brandRow.h}
          />
        </RecordingScreen>
      </CameraSegment>

      {/* 68–78：顺着面板竖直摇到底。够快，开运动模糊 */}
      <CameraSegment
        from={pad + WHIP}
        durationInFrames={MODEL_OPEN - WHIP}
        blur
        cam={{ from: CAM_SWAP, to: CAM_MODELROW }}
      >
        <RecordingScreen
          src="G段.mp4"
          startSeconds={G_SWAP + (WHIP - PICK_AGENT) / 30}
        />
      </CameraSegment>

      {/* 78–92：模型弹层展开，列的是这个 Agent 自己的 models */}
      <CameraSegment
        from={pad + MODEL_OPEN}
        durationInFrames={MODEL_PICK - MODEL_OPEN}
        cam={{ from: CAM_MODELROW, to: CAM_MODEL }}
      >
        <RecordingScreen
          src="G段.mp4"
          startSeconds={G_MODEL}
          playbackRate={G_MODEL_RATE}
        />
      </CameraSegment>

      {/* 92–末尾：选中 DeepSeek-V3.1。末段要一直铺到本镜末尾，
          最后 8 帧是和镜头 8 交叠的那半个 fade */}
      <CameraSegment
        from={pad + MODEL_PICK}
        durationInFrames={durationInFrames - pad - MODEL_PICK}
        cam={{ from: CAM_MODEL, to: CAM_END }}
      >
        <RecordingScreen
          src="G段.mp4"
          startSeconds={G_PICK}
          playbackRate={G_MODEL_RATE}
        />
      </CameraSegment>

      <ScreenLine text={SHOTS[6].screen} frame={f} enter={58} exit={94} />
    </AbsoluteFill>
  );
};
