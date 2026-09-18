import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  linearTiming,
  TransitionPresentation,
  TransitionSeries,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";

import { COLORS, FONT_FAMILY } from "./theme";
import {
  FPS,
  SHOTS,
  shotFrames,
  TransitionKind,
  TRANSITION_FRAMES,
} from "./shots";

import { Shot1Dilemma } from "./scenes/Shot1Dilemma";
import { Shot2Expertise } from "./scenes/Shot2Expertise";
import { Shot3Context } from "./scenes/Shot3Context";
import { Shot4Ask } from "./scenes/Shot4Ask";
import { Shot5Reasoning } from "./scenes/Shot5Reasoning";
import { Shot6Backflow } from "./scenes/Shot6Backflow";
import { Shot7Partner } from "./scenes/Shot7Partner";
import { Shot8Finale } from "./scenes/Shot8Finale";

const SCENE_COMPONENTS: React.FC[] = [
  Shot1Dilemma,
  Shot2Expertise,
  Shot3Context,
  Shot4Ask,
  Shot5Reasoning,
  Shot6Backflow,
  Shot7Partner,
  Shot8Finale,
];

/**
 * 片头闪回（v2 审片局部 15：「片头最好复用片尾画面 0.4 秒，这样视频一上来有个主题」）。
 *
 * 12 帧 = 0.4s，画面就是片尾落版的静止版（**不打字** —— 打字是片尾那次的活），
 * 后 6 帧压在镜头 1 的头上淡出，交接是软的。
 *
 * ⚠️ 整条 TransitionSeries 和 BGM 一起挂在 `<Sequence from={INTRO_FRAMES}>` 下，
 * 所以「BGM 相对镜头」的位置一帧没变 —— 18s 前副歌、31s 副歌起、43s 收束层
 * 仍旧压在原来那几道接缝上。合成总长因此是 TOTAL_FRAMES + INTRO_FRAMES。
 */
export const INTRO_FRAMES = 12;
/** 淡出压在镜头 1 头上的帧数 */
const INTRO_TAIL = 6;

/**
 * BGM 的长度：48.00s = 1440 帧，**和 TOTAL_FRAMES 不再相等**
 * （镜头 8 为了尾巴上那三件事加长了 0.7s，见 shots.ts）。
 * 音乐仍从正片第 0 帧对齐播完，段落时间码一个没动；片子比它长出来的 0.7s 是落版定格。
 */
const BGM_FRAMES = 48 * FPS;

const IntroTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [INTRO_FRAMES - 3, INTRO_FRAMES + INTRO_TAIL],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.surface1,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_FAMILY,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ width: 156, height: 156, marginBottom: 44 }}
      />
      <div
        style={{
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: 2,
          color: COLORS.fg,
        }}
      >
        MS Insight 智能助手
      </div>
      <div
        style={{
          marginTop: 26,
          fontSize: 36,
          letterSpacing: 4,
          color: COLORS.blue,
        }}
      >
        从数据到证据，从结论回到现场
      </div>
    </AbsoluteFill>
  );
};

/** 三种转场的返回类型各不相同，统一成一个宽类型才能塞进同一个 map */
type ShotTransition = TransitionPresentation<Record<string, unknown>>;

const presentationOf = (kind: TransitionKind): ShotTransition => {
  switch (kind) {
    // 概念 → 具象那一刀，全片只此一处
    case "flip":
      return flip({
        direction: "from-right",
        perspective: 1600,
      }) as unknown as ShotTransition;
    case "slide":
      return slide({ direction: "from-right" }) as unknown as ShotTransition;
    case "fade":
    default:
      return fade() as unknown as ShotTransition;
  }
};

/**
 * 全片主时间轴。
 * 场景顺序、时长、转场全部由 src/shots.ts 决定 —— 调节奏改那个文件，不要改这里。
 * 没写 transitionAfter 的地方是硬切，尤其 5 → 6：一去一回必须同镜位连着走。
 */
export const LaunchVideo: React.FC = () => {
  const frame = useCurrentFrame();
  /**
   * 音量收尾要挂在**音乐自己的末尾**上，不是片子的末尾 ——
   * 镜头 8 加长 0.7s 之后 TOTAL_FRAMES（1461）比 BGM（1440）长，两者不再是同一个数。
   * ⚠️ frame 是合成帧（含片头 12 帧），所以再加上 INTRO_FRAMES。
   * 30 帧的缓收：音乐在正片 48s 处落干净，画面再定格 0.7s 收片。
   */
  const volume = interpolate(
    frame,
    [INTRO_FRAMES + BGM_FRAMES - 30, INTRO_FRAMES + BGM_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      {/* 正片整体后移 INTRO_FRAMES —— BGM 跟着一起移，两者的相对关系不变 */}
      <Sequence from={INTRO_FRAMES} layout="none">
      {/* BGM：138 BPM / 4分之4 / 48.00s，正好等于 TOTAL_FRAMES。
          段落切换是按这张分镜表写死在绝对时间码上的（18s 前副歌、30.5s 过门、
          31s 副歌起压在 5→6 那道唯一的硬切上、43s 收束层），
          所以它只要从第 0 帧对齐播完，重音自然落在镜头切换帧上 —— 不用再手工卡点。 */}
      <Audio
        src={staticFile("ms-insight-original-bgm-v5-smooth-percussion.wav")}
        volume={volume}
      />

      <TransitionSeries>
        {SHOTS.flatMap((shot, i) => {
          const Scene = SCENE_COMPONENTS[i];
          const nodes = [
            <TransitionSeries.Sequence
              key={`shot-${shot.n}`}
              durationInFrames={shotFrames(i)}
            >
              <Scene />
            </TransitionSeries.Sequence>,
          ];
          if (shot.transitionAfter) {
            nodes.push(
              <TransitionSeries.Transition
                key={`transition-${shot.n}`}
                presentation={presentationOf(shot.transitionAfter)}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          }
          return nodes;
        })}
      </TransitionSeries>
      </Sequence>

      {/* 片头闪回：盖在最上面，后 6 帧压着镜头 1 的头淡出 */}
      <Sequence durationInFrames={INTRO_FRAMES + INTRO_TAIL} layout="none">
        <IntroTitle />
      </Sequence>
    </AbsoluteFill>
  );
};
