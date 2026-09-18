import { useCurrentFrame, useVideoConfig } from "remotion";
import { shotBaseFrames, shotInPad } from "../shots";

/**
 * 本镜前面被转场借走的帧数。
 *
 * 同一个场景组件跑在两个地方，起点差半个转场：
 *   · Root.tsx 单镜预览 —— durationInFrames = seconds × FPS，前面没有 padding；
 *   · Video.tsx 的 TransitionSeries —— 前面多出半个转场（见 shotFrames）。
 * 场景里凡是要写死帧号的地方（含 <Sequence from>）都得把它加回去，
 * 否则单镜预览对得上、连播就整体偏 8 帧。
 */
export const useShotPad = (index: number): number => {
  const { durationInFrames } = useVideoConfig();
  const nominal = shotBaseFrames(index);
  return durationInFrames > nominal ? shotInPad(index) : 0;
};

/**
 * 场景内部一律用这个取帧，别直接 useCurrentFrame()。
 * 返回值的 0 == 分镜细表里的 0.0s，于是细表时间码可以直接乘 FPS 写成常量。
 */
export const useShotFrame = (index: number): number =>
  useCurrentFrame() - useShotPad(index);
