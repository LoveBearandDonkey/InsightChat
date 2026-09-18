import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";

/**
 * 全片所有镜头运动都走这一个组件（PLAN.md D3）。
 * 风格统一靠的就是「只有一处能改镜头」，比事后一个个调省太多。
 *
 * 关键设计：用 focusX / focusY 指「画面里哪个点要落到正中」，而不是手算 translate。
 * 于是「录一整屏，后期推近输入框」就是一句 to={{ scale: 2.4, focusX: 78, focusY: 66 }}。
 */

export type CameraPose = {
  /** 缩放。1 = 全景，2 = 只看画面的一半 */
  scale?: number;
  /** 画面里哪个点落到正中，单位是画幅百分比。50/50 就是不平移 */
  focusX?: number;
  focusY?: number;
  /** 额外像素微调，对齐不上时用 */
  x?: number;
  y?: number;
  /** 绕 Y 轴摆（左右侧视角），绕 X 轴俯仰 */
  rotateY?: number;
  rotateX?: number;
};

const DEFAULT_POSE: Required<Omit<CameraPose, "x" | "y">> & { x: number; y: number } = {
  scale: 1,
  focusX: 50,
  focusY: 50,
  x: 0,
  y: 0,
  rotateY: 0,
  rotateX: 0,
};

const resolve = (pose: CameraPose) => ({ ...DEFAULT_POSE, ...pose });

export type CameraShotProps = {
  from: CameraPose;
  to: CameraPose;
  /** 运镜从本场景第几帧开始 */
  startFrame?: number;
  /** 运镜走多少帧。默认走满整个场景 */
  durationInFrames?: number;
  /**
   * 运动模糊。默认 false —— 官方警告它对颜色是破坏性的，
   * 浅底上发灰更明显，所以只在真正快速的推拉/旋转那几秒开，别全片套。
   * 开的时候 samples 固定 4，不要上 8。
   */
  blur?: boolean;
  /** 透视强度。越小越"广角"，旋转时形变越夸张 */
  perspective?: number;
  /** "ease" 平滑推拉（默认）；"spring" 带一点物理惯性，用在需要"顿一下"的地方 */
  timing?: "ease" | "spring";
  children: React.ReactNode;
};

/** 真正做位移的一层。必须在 CameraMotionBlur 内部，模糊靠的是对邻近帧重采样 */
const MovingLayer: React.FC<Omit<CameraShotProps, "blur">> = ({
  from,
  to,
  startFrame = 0,
  durationInFrames,
  perspective = 1600,
  timing = "ease",
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: sceneDuration } = useVideoConfig();
  const duration = durationInFrames ?? sceneDuration - startFrame;
  const local = frame - startFrame;

  const progress =
    timing === "spring"
      ? spring({
          frame: local,
          fps,
          durationInFrames: duration,
          config: { damping: 200 },
        })
      : interpolate(local, [0, duration], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.33, 0, 0.15, 1),
        });

  const a = resolve(from);
  const b = resolve(to);
  const at = (key: keyof typeof a) => a[key] + (b[key] - a[key]) * progress;

  const scale = at("scale");
  const dx = 50 - at("focusX");
  const dy = 50 - at("focusY");

  return (
    <AbsoluteFill style={{ perspective, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformStyle: "preserve-3d",
          // 右往左读：先把 focus 点平移到正中，再缩放，最后摆角度
          transform: [
            `rotateY(${at("rotateY")}deg)`,
            `rotateX(${at("rotateX")}deg)`,
            `scale(${scale})`,
            `translate(${dx}%, ${dy}%)`,
            `translate(${at("x")}px, ${at("y")}px)`,
          ].join(" "),
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const CameraShot: React.FC<CameraShotProps> = ({ blur = false, ...props }) => {
  if (!blur) {
    return <MovingLayer {...props} />;
  }
  return (
    <CameraMotionBlur samples={4} shutterAngle={180}>
      <MovingLayer {...props} />
    </CameraMotionBlur>
  );
};
