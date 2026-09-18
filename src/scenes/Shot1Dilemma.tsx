import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";

import { GridBackdrop } from "../components/GridBackdrop";
import { ScreenLine } from "../components/ScreenLine";
import { Shard, SHARDS } from "../components/ChartShards";
import { Gauge, gaugeTremor } from "../components/Gauge";
import { useShotFrame } from "../components/useShotFrame";
import { COLORS } from "../theme";
import { SHOTS } from "../shots";

/**
 * 镜头 1 ｜ 0:00–0:04 ｜ 困局
 * 节拍照 PLAN.md「分镜细表」第 1 条，帧号写死在下面这组常量里（30fps）：
 *   0–42    浅灰白底 + 二三十张图表碎片密集铺满，数字和图形一起乱跳
 *   42–     **仪表盘先从图表墙上浮出来**
 *   56–88   仪表盘立住之后，图表墙才向后淡化让位
 *   72–120  指针扫到 75 撞墙反弹，卡在 75 微颤
 *
 * ⚠️ 75 是 chat.html 演示里实算出的性能健康度，和镜头 5 报告是同一个数，别改。
 * ⚠️ 全片明度最低的一镜，也只到 #F2F2F2 —— 过载感来自密度，不来自昏暗。
 * ⚠️ **末尾 20 帧盘子本身完全静止**（只有指针在微颤）：这里接着一个 fade 转场到镜头 2，
 *   缩放/位移只要有一边还在动，接缝上就是审片说的那种「主角抖一下」（v1 局部 3）。
 *   指针的微颤是**跨镜连续的同一条曲线**（gaugeTremor，镜头 2 传 f+120），所以它不算「动」。
 *
 * ⚠️ v2 审片局部 1：「1~2 秒，仪表盘先出现，图表墙再消失」——
 *   上一版是墙先淡（42）盘后浮（60），因果反了；现在盘 42 起、墙 56 才开始退。
 */

/** 图表墙开始淡化后撤 —— 一定要晚于 GAUGE_IN */
const FADE_IN = 56;
const FADE_OUT = 88;
/** 仪表盘开始浮出（v2 局部 1：它是先来的那个） */
const GAUGE_IN = 42;
/** 指针撞墙那一帧 */
const IMPACT = 94;
/** 从这一帧起盘体锁死，交给转场 */
const FREEZE = 100;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Shot1Dilemma: React.FC = () => {
  const f = useShotFrame(0);
  const { fps } = useVideoConfig();

  // —— 0–42：碎片洪流。逐张 spring 落位，12 帧内全部到齐 ——
  // —— 56–88：盘子立住之后，整墙才向后淡化（略微收缩 + 发虚）让位 ——
  const recede = interpolate(f, [FADE_IN, FADE_OUT], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const shardFade = interpolate(recede, [0.1, 1], [1, 0], clamp);
  const shardBlur = recede * 5;
  // 只往中心收一点点，是「让位」不是「被吸走」
  const converge = recede * 0.14;

  // —— 42–：仪表盘从墙面上浮出来（先于墙的淡化）——
  const gaugeIn = spring({
    frame: f - GAUGE_IN,
    fps,
    durationInFrames: 26,
    config: { damping: 16, mass: 0.7 },
  });

  // 指针：快速扫到 75 → 撞墙冲过头 → 反弹 → 停在 75 并**保持微颤**（v2 局部 4）
  const sweep = Math.min(
    75,
    interpolate(f, [72, IMPACT], [0, 75], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    }),
  );
  const bounce =
    f <= IMPACT
      ? 0
      : 3.6 *
        Math.exp(-(f - IMPACT) / 7) *
        Math.cos((f - IMPACT) * 0.55) *
        // FREEZE 之后强制归零，反弹交给微颤接手
        interpolate(f, [FREEZE - 6, FREEZE], [1, 0], clamp);
  // 反弹收干净之后，指针交给那支跨镜连续的微颤 —— 镜头 2 会用 gaugeTremor(f + 120) 接上
  const tremor =
    gaugeTremor(f) * interpolate(f, [IMPACT + 6, IMPACT + 16], [0, 1], clamp);
  const value = sweep + bounce + tremor;

  // 撞墙那一瞬 75 那道栏杆闪一下红，随即褪回灰（**不再染 75~100 那段弧**，v2 局部 2）
  const wallFlash = interpolate(
    f,
    [IMPACT - 2, IMPACT + 1, IMPACT + 14],
    [0, 1, 0],
    clamp,
  );

  // 盘子自己的入场缩放。damping 16 的 spring 会轻微过冲，
  // 所以 FREEZE 前 8 帧起把它强行拉平到 1 —— 末帧一定是完全静止的
  const settle = interpolate(f, [FREEZE - 8, FREEZE], [0, 1], clamp);
  const gaugeScale = interpolate(
    gaugeIn + (1 - gaugeIn) * settle,
    [0, 1],
    [0.86, 1],
    clamp,
  );

  return (
    <AbsoluteFill>
      <GridBackdrop background={COLORS.surface2} />

      {/* 图表墙。整墙一起淡化后撤，不再绕 X 轴翻滚 */}
      {shardFade > 0.001 ? (
        <AbsoluteFill
          style={{
            filter: shardBlur > 0.05 ? `blur(${shardBlur.toFixed(2)}px)` : undefined,
            transformOrigin: "50% 46%",
            transform: `scale(${1 - recede * 0.06})`,
          }}
        >
          {SHARDS.map((spec) => {
            const land = spring({
              frame: f - spec.enterAt,
              fps,
              durationInFrames: 18,
              config: { damping: 200 },
            });
            const x =
              spec.fromX +
              (spec.x - spec.fromX) * land +
              (960 - spec.x) * converge;
            const y =
              spec.fromY +
              (spec.y - spec.fromY) * land +
              (540 - spec.y) * converge;
            return (
              <Shard
                key={spec.id}
                spec={spec}
                f={f}
                x={x}
                y={y}
                scale={0.86 + 0.14 * land}
                opacity={land * shardFade}
              />
            );
          })}
        </AbsoluteFill>
      ) : null}

      {/* 仪表盘浮出。和图表墙淡化有 18 帧重叠，看着像「从这堆数里升起来的」 */}
      {gaugeIn > 0.001 ? (
        <AbsoluteFill
          style={{
            transformOrigin: "50% 43.5%",
            transform: `scale(${gaugeScale})`,
            opacity: gaugeIn,
          }}
        >
          <Gauge value={value} wallAt={75} wallFlash={wallFlash} />
        </AbsoluteFill>
      ) : null}

      <ScreenLine text={SHOTS[0].screen} frame={f} enter={8} />
    </AbsoluteFill>
  );
};
