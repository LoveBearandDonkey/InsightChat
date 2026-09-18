import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useVideoConfig,
} from "remotion";

import { CardWall, Lockup, TypedSlogan } from "../components/CardWall";
import { CameraPose } from "../components/CameraShot";
import { Callout } from "../components/Marker";
import { CameraSegment, RecordingScreen, UI } from "../components/RecordingScreen";
import { ScreenLine } from "../components/ScreenLine";
import { useShotFrame, useShotPad } from "../components/useShotFrame";
import { COLORS } from "../theme";

/**
 * 镜头 8 ｜ 0:40.5–0:48.7 ｜ 场景与落版（8.2s = 246 帧）
 *
 * ⚠️ 审片意见落在这里：
 *   局部 17｜「回答完 → 切换模型 → 欢迎页」一秒里闪三个页面，读者反应不过来。
 *          本镜由 7s 加到 7.5s（多出来的 0.5s 从镜头 7 借），并且 H段 的入点
 *          由 2.35s **提前到 1.50s** —— 开头整整 1.1 秒画面就停在答完的那一页上，不动。
 *   局部 18/19｜卡片墙的 C 位、图标、一句话描述，全在 CardWall.tsx 里改。
 *          卡片墙自己也多留半秒再收拢。
 *   局部 20｜落版 slogan 改成打字机，紫 → 蓝，**去掉句号**。
 *   局部 8｜logo 用 PNG。
 *
 * ⚠️ v2 局部 14：「结尾 slogan 打字都来不及打完，最好打完后停留 1 秒」。
 *   上一版是 `LOCKUP 196` + 10 帧起打 + 14 字 × 2 帧 = 打到第 234 帧，
 *   而本镜只有 225 帧 —— 观众看到的就是「打到『结』字就没了」。
 *
 * ⚠️ **本镜由 7.5s 加到 8.2s（246 帧），全片 48 → 48.7s。**
 *   尾巴上三件事互相挤不动：卡片墙至少停 0.5s（点名要的）、slogan 要打完、打完还要定格 1s。
 *   与其继续压前面（开场那 1.1 秒是 v1 局部 17 点名要的，欢迎页再快就看不清了），
 *   不如把片长放开 —— BGM 仍是 48.00s、仍从正片第 0 帧对齐，段落时间码一帧没动，
 *   多出来的 0.7s 落在片尾：**音乐先收干净，画面再定格收片**。
 *
 * 节拍（30fps），H段-依次悬浮引导卡 里实测的时间点：
 *   0–33     源 1.50s 起。**答完的页面停住**（1.1 秒，不再是一秒里闪三个页面）
 *   33–48    2.60s 点右上角「新建对话」（= 帧 33）→ 欢迎页重建，点阵底纹整块画出来
 *   48–108   源 3.10s 起、1.55 倍速：打字机打完，光标依次划过三张牵引卡（到源 6.20s）
 *   108–130  镜头拉远拉正回到 scale 1（卡片墙要接在这个落位上）
 *   130–148  录屏整体淡出，白底透出来
 *   132–163  三张真卡原位接手 → 长成 5×3 的场景卡片墙（标题 + 一句话描述）
 *   163–180  **卡片墙停满 17 帧 ≈ 0.57 秒** —— 点名要的那半秒，不许再压
 *   180–202  卡片墙旋转收拢
 *   190–     logo + MS Insight 智能助手 + 打字机 slogan
 *   214–246  slogan 打完**定格 32 帧 ≈ 1.07 秒**，收在全片最亮的一帧上
 *
 * ⚠️ 分镜细表写「三张牵引卡依次浮出」。**录屏里它们没有入场动画** ——
 * 点新建对话时欢迎页本来就带着三张卡一起重建，卡片自己不逐张浮。
 * 这里没有假造一个入场，改用素材里真有的那一遍「光标依次悬浮三张卡」当这一拍。
 * ⚠️ 也**别点卡片**：卡片的 data-prompt 是被忽略的，点下去输入框会被填成内置的
 * PROFILING_QUESTION，画面立刻穿帮（见 D2「H 段」）。素材里就只悬浮、没点。
 */

/** 答完的页面停到这一帧才点「新建对话」—— 审片要的那 1.1 秒 */
const NEW_CHAT = 33;
const WELCOME = 48;
const PULL_BACK = 108;
const SETTLE = 130;
const REC_END = 148;
const SEED = 132;
const GROW = 136;
/** ⚠️ 卡片墙 163 帧长完，到这里停满 17 帧 —— **审片点名要的那半秒，别再往前挪** */
const COLLAPSE = 180;
const LOCKUP = 190;
/** slogan 起打的帧。14 字 × 1.5 帧 ⇒ 214 打完，到本镜末尾还剩 32 帧（1.07 秒）定格 */
const SLOGAN = 194;

/** 本镜第 0 帧对应 H段 里的第几秒。源 2.60s 点新建对话 = 帧 33 ⇒ 2.60 - 33/30 = 1.50 */
const H_START = 1.5;
/**
 * 欢迎页那一段快放，把「打字机 + 三次悬浮」压进 2 秒。
 * 入点源 3.10s、出点源 6.20s（第三张卡悬浮完）÷ 60 帧 ⇒ 1.55 倍。
 * ⚠️ 别再往上调 —— 打字机再快就读不清了，尾巴不够就加片长（本镜已加到 8.2s）。
 */
const H_WELCOME = H_START + WELCOME / 30;
const H_RATE = 1.55;

const at = (scale: number, x: number, y: number): CameraPose => ({
  scale,
  focusX: (x / 1920) * 100,
  focusY: (y / 1080) * 100,
});

/** 起手还压着上一镜的近景，接得住 fade。这一段镜头几乎不动，让画面「停住」 */
const CAM_HOLD = at(1.3, 1177, 400);
/** 欢迎页起势：头像 + 打字机在画面中上部 */
const CAM_WELCOME = at(1.16, 1088, 470);
/** 光标依次划过三张卡，视线下移 */
const CAM_CARDS = at(1.22, 1129, 600);
/**
 * 拉远拉正到 scale 1 / 焦点正中。
 * **CardWall 的三张种子卡就贴着这个落位画** —— 改这里，卡片墙的接缝就开了。
 */
const CAM_OUT = at(1, 960, 540);

export const Shot8Finale: React.FC = () => {
  const f = useShotFrame(7);
  const pad = useShotPad(7);
  const { fps } = useVideoConfig();

  // 录屏整体淡出，白底透出来；卡片墙就在这层白底上长
  const recFade = interpolate(f, [SETTLE - 4, REC_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const nameRise = spring({
    frame: f - LOCKUP - 4,
    fps,
    durationInFrames: 20,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      {/* 0–48：答完的页面先停住 1.1 秒，帧 33 才点「新建对话」，欢迎页重建 */}
      <CameraSegment
        from={0}
        durationInFrames={pad + WELCOME}
        cam={{ from: CAM_HOLD, to: CAM_WELCOME }}
      >
        <RecordingScreen src="H段-依次悬浮引导卡.mp4" startSeconds={H_START - pad / 30}>
          <Callout
            frame={f}
            enter={NEW_CHAT - 8}
            exit={NEW_CHAT + 6}
            x={UI.newChat.x + UI.newChat.w / 2}
            y={UI.newChat.y + UI.newChat.h}
            side="bottom"
            text="新建对话"
            size={24}
          />
        </RecordingScreen>
      </CameraSegment>

      {/* 48–108：打字机打完 → 光标依次划过三张牵引卡。快放，把这一拍压进 2 秒 */}
      <CameraSegment
        from={pad + WELCOME}
        durationInFrames={PULL_BACK - WELCOME}
        cam={{ from: CAM_WELCOME, to: CAM_CARDS }}
      >
        <RecordingScreen
          src="H段-依次悬浮引导卡.mp4"
          startSeconds={H_WELCOME}
          playbackRate={H_RATE}
        />
      </CameraSegment>

      {/* 108–148：拉远拉正 → 录屏淡出。淡出必须在镜头到位（SETTLE）之后才走完，
          否则卡片墙接手时下面那三张还在动 */}
      <Sequence
        from={pad + PULL_BACK}
        durationInFrames={REC_END - PULL_BACK}
        layout="none"
      >
        <div style={{ opacity: recFade }}>
          <CameraSegment
            from={0}
            durationInFrames={SETTLE - PULL_BACK}
            cam={{ from: CAM_CARDS, to: CAM_OUT }}
          >
            <RecordingScreen
              src="H段-依次悬浮引导卡.mp4"
              startSeconds={H_WELCOME + ((PULL_BACK - WELCOME) / 30) * H_RATE}
              playbackRate={H_RATE}
            />
          </CameraSegment>
          <CameraSegment
            from={SETTLE - PULL_BACK}
            durationInFrames={REC_END - SETTLE}
            cam={{ from: CAM_OUT, to: CAM_OUT }}
          >
            <RecordingScreen
              src="H段-依次悬浮引导卡.mp4"
              startSeconds={H_WELCOME + ((SETTLE - WELCOME) / 30) * H_RATE}
              playbackRate={H_RATE}
            />
          </CameraSegment>
        </div>
      </Sequence>

      {/* 132–202：三张真卡原位接手 → 铺成场景卡片墙（C 位）→ 停满半秒 → 旋转收拢。
          画在 CameraShot 外面，靠 CAM_OUT 已经回到 scale 1 对上位 */}
      <CardWall frame={f} seed={SEED} grow={GROW} collapse={COLLAPSE} />

      {/* 190–：落版。纯白底，产品名 #191919，slogan 打字机紫 → 蓝。
          ⚠️ slogan 必须在 214 帧打完 —— 末尾要留满 1 秒定格（v2 局部 14） */}
      <Lockup frame={f} enter={LOCKUP}>
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
            transform: `translateY(${(1 - nameRise) * 22}px)`,
            opacity: nameRise,
          }}
        >
          MS Insight 智能助手
        </div>
        {/* 去掉句号；逐字打出，刚落笔是紫的，8 帧内渐变到主蓝。
            每字 1.5 帧（上一版 2 帧，打不完） */}
        <TypedSlogan
          text="从数据到证据，从结论回到现场"
          frame={f}
          enter={SLOGAN}
          perChar={1.5}
          settle={8}
        />
      </Lockup>

      <ScreenLine
        text="更多性能调优场景，等你来解锁"
        frame={f}
        enter={GROW + 10}
        exit={COLLAPSE - 6}
      />
    </AbsoluteFill>
  );
};
