import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";

import { CameraShot } from "../components/CameraShot";
import {
  Gauge,
  GAUGE_CENTER,
  GAUGE_SIZE,
  gaugeTremor,
} from "../components/Gauge";
import { GridBackdrop } from "../components/GridBackdrop";
import { KnowledgeCards } from "../components/KnowledgeCards";
import { ScreenLine } from "../components/ScreenLine";
import { useShotFrame, useShotPad } from "../components/useShotFrame";
import { INPUT_BOX, Workbench } from "../components/Workbench";
import { COLORS } from "../theme";
import { SHOTS } from "../shots";

/**
 * 镜头 2 ｜ 0:04–0:10 ｜ 专家经验入场，工具现形
 * 节拍（30fps）。⚠️ v2 审片局部 5 / 6 之后重排过，和上一版的帧号**全不一样**：
 *   0–44     底色升到纯白；12 张知识卡飞入，**停在盘两侧读得清**（第一拍）
 *   46–64    知识卡整组收拢、沉到盘背后（第二拍 —— 「被集成」这个动作）
 *   54–62    指针反向蓄力一顿（接在集成之后，因果才成立）
 *   62–78    破 75 那道栏杆 → 扫满到 92，色条由黄转绿
 *   80–106   盘面环形收缩，**收成 logo**（logo 大小由收缩中的那圈环直接决定）
 *   102–140  镜头拉远 + 视角略偏转，工作台由中间向两侧现形 —— 「逐渐看到界面全貌」
 *   106–128  居中的 logo 原地淡出（**比上一版早整整 1 秒**，v2 局部 6）
 *   140–180  沿着面板推近右侧输入框（镜头 3 的落点），视角收正
 *
 * ⚠️ 审片意见落在这里：
 *   局部 3｜**前 24 帧镜头必须静止**。上一镜末帧已经锁死，这边也不动，fade 才接得干净。
 *   局部 7｜盘 → logo 不再是两张图淡入淡出，logo 的大小/圆心跟着收缩环走，是真的「形变」。
 *   局部 7｜三段 CameraShot 的首尾姿态过去对不上（1 → 1.62、rotateY 0 → -17），
 *          **交界处每帧硬跳一次，这就是「背景格子消失后主角抖一下」的根因**。现在严格咬合。
 *   局部 8｜logo 用 PNG：logo.svg 根节点引用了不存在的 mask_0，只渲染得出一小块。
 *   局部 9｜删掉从 logo 长出去的三条脉络线（那就是「奇怪的触角」）和 logo 飞向头像的位移。
 *   局部 10｜删掉 360° 环绕，直接推近输入框。
 *
 * 结构说明：Stage 是纯函数组件，帧号由外层算好传进来。
 * 三段运镜各套一层 CameraShot，靠 Sequence 切段 —— Sequence 会重置 useCurrentFrame，
 * 正好让 CameraShot 自己按段计时，而 Stage 拿到的仍是本镜绝对帧。
 */

/** 知识卡飞入这一拍结束、底色升到纯白的时间点 */
const CARD_IN = 44;
/** 第二拍：卡片收拢到盘背后（v2 局部 5） */
const GATHER_START = 46;
const GATHER_END = 64;
/** 指针蓄力 → 破墙。**接在收拢之后**，观众才会读成「被集成，所以顶上去了」 */
const DIP_START = 54;
const BREAK_START = 62;
const BREAK_END = 78;
const MORPH_START = 80;
const MORPH_END = 106;
const BUILD_START = 102;
/** 居中 logo 淡出。v2 局部 6：比上一版（134–156）早整整 1 秒 */
const LOGO_OUT_START = 106;
const LOGO_OUT_END = 128;
const PUSH_START = 140;
const SHOT_END = 180;

/** 上一镜是静止收尾的，这边也静止这么多帧，fade 转场才没有接缝 */
const HOLD = 20;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * 指针读数：75 起（**带着镜头 1 那支微颤继续走**），蓄力下沉，再冲过栏杆到 92。
 *
 * ⚠️ `gaugeTremor(f + 120)`：120 是镜头 1 的帧数，也正好是本镜 f=0 在全片时间轴上的位置。
 * 两镜喂同一条曲线，fade 转场那 16 帧里两只盘的指针才严丝合缝（v1 局部 3 的抖动就是这么来的）。
 */
const needleValue = (f: number) => {
  if (f < DIP_START) {
    return 75 + gaugeTremor(f + 120);
  }
  if (f < BREAK_START) {
    return interpolate(f, [DIP_START, BREAK_START], [75, 67.5], {
      ...clamp,
      easing: Easing.inOut(Easing.quad),
    });
  }
  const sweep = interpolate(f, [BREAK_START, BREAK_END], [67.5, 92], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  // 冲过头再回落，比直接停在 92 有劲
  const over =
    f > 70 ? 3.2 * Math.exp(-(f - 70) / 6) * Math.sin((f - 70) * 0.6) : 0;
  return sweep + over;
};

const Stage: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  // 底色 #F2F2F2 → #FFFFFF：用明度递进代替明暗对比，全片无黑底
  const lift = interpolate(f, [0, CARD_IN], [0, 1], clamp);
  const tone = Math.round(242 + 13 * lift);
  const bg = `rgb(${tone},${tone},${tone})`;
  const gridFade = interpolate(
    f,
    [BUILD_START - 12, BUILD_START + 14],
    [1, 0],
    clamp,
  );

  const value = needleValue(f);
  // 蓄力那一顿栏杆先绷红，指针越过去栏杆才碎。
  // ⚠️ 红色只在 75 那道栏杆上，绝不染 75~100 那段弧（v2 局部 2，实现见 Gauge.tsx）
  const wallFlash = interpolate(f, [54, 60, 65, 71], [0, 0.5, 1, 0], clamp);
  const wallOpacity = interpolate(f, [64, 73], [1, 0], clamp);

  // 第二拍：知识卡收拢到盘背后 —— 破墙紧跟其后，于是「92」看上去是被集成顶上去的
  const gather = interpolate(f, [GATHER_START, GATHER_END], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });

  // —— 盘 → logo 的形变 ——
  // 一圈环从盘面外缘收到 logo 半径；logo 的大小和位置完全跟着这圈环走，
  // 所以观众看到的是「盘子收成了一枚 logo」，不是两张图在互相淡入淡出。
  const morph = interpolate(f, [MORPH_START, MORPH_END], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const gaugeOpacity = interpolate(
    f,
    [MORPH_START + 6, MORPH_START + 22],
    [1, 0],
    clamp,
  );
  const LOGO_R = 96;
  const ringR = interpolate(morph, [0, 1], [GAUGE_SIZE * 0.405, LOGO_R], clamp);
  const ringOpacity = interpolate(
    morph,
    [0, 0.18, 0.82, 1],
    [0, 1, 1, 0],
    clamp,
  );

  // 卡片被一起吸进收缩的环里
  const absorb = interpolate(f, [MORPH_START, MORPH_END - 8], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });

  // 微光：卡片收拢到盘背那一拍最亮 —— 亮的是「被集成」这件事
  const glow = interpolate(f, [16, GATHER_END, MORPH_END], [0, 1, 0], clamp);

  // logo：直径 = 收缩中那圈环的直径 × 1.44，圆心恒等于盘心。
  // 环还大的时候 logo 已经在里面淡出来了，环收到位时它正好是最终大小 —— 这就是形变本身。
  const logoSize = ringR * 1.44;
  const logoOpacity =
    interpolate(morph, [0.28, 0.62], [0, 1], clamp) *
    // 工作台一现形 logo 就原地淡出（v2 局部 6：比上一版早 1 秒），
    // 不再飞去欢迎页头像（v1 局部 9）
    interpolate(f, [LOGO_OUT_START, LOGO_OUT_END], [1, 0], clamp);

  // 工作台：中间先立住，再向左右两侧展开 —— 「拉远，逐渐看到界面全貌」
  const at = (a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <GridBackdrop background={bg} opacity={gridFade} />

      <Workbench mid={at(102, 120)} left={at(112, 130)} right={at(120, 140)} />

      {/* 知识库透出的微光 */}
      {glow > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: GAUGE_CENTER.x - 620,
            top: GAUGE_CENTER.y - 620,
            width: 1240,
            height: 1240,
            opacity: glow * 0.75,
            background:
              "radial-gradient(circle at center, rgba(67,105,239,0.20) 0%, rgba(67,105,239,0.08) 38%, rgba(67,105,239,0) 66%)",
          }}
        />
      ) : null}

      <KnowledgeCards f={f} fps={fps} gather={gather} absorb={absorb} />

      {gaugeOpacity > 0.001 ? (
        <AbsoluteFill
          style={{
            transformOrigin: `${GAUGE_CENTER.x}px ${GAUGE_CENTER.y}px`,
            // 盘面跟着环一起收，两者的收缩率一致，形变才连贯
            transform: `scale(${ringR / (GAUGE_SIZE * 0.405)})`,
          }}
        >
          <Gauge
            value={value}
            wallAt={75}
            wallFlash={wallFlash}
            wallOpacity={wallOpacity}
            faceOpacity={gaugeOpacity}
            scoreOpacity={interpolate(
              f,
              [MORPH_START, MORPH_START + 8],
              [1, 0],
              clamp,
            )}
          />
        </AbsoluteFill>
      ) : null}

      {/* 收缩环：盘面收成 logo 的那一圈 */}
      {ringOpacity > 0.001 ? (
        <svg
          width={1920}
          height={1080}
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <circle
            cx={GAUGE_CENTER.x}
            cy={GAUGE_CENTER.y}
            r={ringR}
            fill="none"
            stroke={COLORS.blue}
            strokeWidth={interpolate(morph, [0, 1], [2, 9], clamp)}
            opacity={ringOpacity}
          />
        </svg>
      ) : null}

      {logoOpacity > 0.001 ? (
        <Img
          src={staticFile("logo.png")}
          style={{
            position: "absolute",
            left: GAUGE_CENTER.x - logoSize / 2,
            top: GAUGE_CENTER.y - logoSize / 2,
            width: logoSize,
            height: logoSize,
            opacity: logoOpacity,
          }}
        />
      ) : null}

      <ScreenLine text={SHOTS[1].screen} frame={f} enter={8} exit={78} />
    </AbsoluteFill>
  );
};

/**
 * 三段运镜的姿态。**首尾必须严格咬合** ——
 * 段边界上只要有一个字段对不上，那一帧就硬跳一次（审片局部 3 / 7 的抖动就是这么来的）。
 */
const CAM_HOLD = { scale: 1, focusX: 50, focusY: 50, rotateY: 0, rotateX: 0 };
/** 盘面收缩期间镜头跟着轻轻推近 —— 第 1 段的终点 = 第 2 段的起点 */
const CAM_MORPH = { scale: 1.35, focusX: 50, focusY: 43.5, rotateY: 0, rotateX: 0 };
/** 拉远看到全貌，同时视角偏出一点点 —— 第 2 段的终点 = 第 3 段的起点 */
const CAM_WIDE = { scale: 1, focusX: 50, focusY: 50, rotateY: -8, rotateX: 3 };
/**
 * 推近右下角的输入框方向，视角收正 —— 镜头 3 的起手位。
 *
 * ⚠️ 焦点**不能**直接取输入框圆心（x≈1673）：这一层底下是整幅 1920×1080 的界面截图，
 * 不像录屏那样带白底圆角卡，推过头右边就是一块露底的空白。
 * 所以焦点按 scale 夹回合法区（960/s、540/s），推的是「往那个方向」，
 * 真正把输入框咬满是下一镜的事。
 */
const PUSH_SCALE = 1.45;
const CAM_INPUT = {
  scale: PUSH_SCALE,
  rotateY: 0,
  rotateX: 0,
  focusX:
    (Math.min(INPUT_BOX.x + INPUT_BOX.w / 2, 1920 - 960 / PUSH_SCALE) / 1920) *
    100,
  focusY:
    (Math.min(INPUT_BOX.y + INPUT_BOX.h / 2, 1080 - 540 / PUSH_SCALE) / 1080) *
    100,
};

export const Shot2Expertise: React.FC = () => {
  const f = useShotFrame(1);
  // ⚠️ <Sequence from> 吃的是原始帧，Stage 里的节拍常量是分镜帧，
  // 两边差着半个转场 —— 分段边界必须把 pad 加回去，否则连播时运镜和节拍错开 8 帧。
  const pad = useShotPad(1);
  const { fps, durationInFrames } = useVideoConfig();
  const stage = <Stage f={f} fps={fps} />;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.surface1 }}>
      {/* 0–105：前 24 帧完全静止（接住上一镜的 fade），之后跟着盘面收缩缓缓推近 */}
      <Sequence durationInFrames={pad + BUILD_START} layout="none">
        <CameraShot
          from={CAM_HOLD}
          to={CAM_MORPH}
          startFrame={pad + HOLD}
          durationInFrames={BUILD_START - HOLD}
        >
          {stage}
        </CameraShot>
      </Sequence>

      {/* 105–156：镜头拉远、视角偏出一点点，工作台由中间向两侧现形 */}
      <Sequence
        from={pad + BUILD_START}
        durationInFrames={PUSH_START - BUILD_START}
        layout="none"
      >
        <CameraShot from={CAM_MORPH} to={CAM_WIDE}>
          {stage}
        </CameraShot>
      </Sequence>

      {/* 156–180：沿面板推近右侧输入框，视角收正（镜头 3 的起手位）。
          全片少数几处真的够快、值得开运动模糊的地方。
          Sequence 要一直铺到本镜末尾（末尾那半个 flip 转场也得有画面），
          运镜本身只走 24 帧，走完停在终点姿态。 */}
      <Sequence
        from={pad + PUSH_START}
        durationInFrames={durationInFrames - pad - PUSH_START}
        layout="none"
      >
        <CameraShot
          blur
          durationInFrames={SHOT_END - PUSH_START}
          from={CAM_WIDE}
          to={CAM_INPUT}
        >
          {stage}
        </CameraShot>
      </Sequence>
    </AbsoluteFill>
  );
};
