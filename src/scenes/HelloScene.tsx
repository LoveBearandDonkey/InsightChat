import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";

const FONT_FAMILY =
  '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';

export const HelloScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="Scene"
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F3F5FB",
      }}
    >
      {/* 炫光 1：左上蓝色光晕，缓慢右移并呼吸 */}
      <Interactive.Div
        name="Glow / 蓝"
        style={{
          position: "absolute",
          width: 1350,
          height: 1350,
          borderRadius: "50%",
          filter: "blur(60px)",
          backgroundImage:
            "radial-gradient(circle, rgba(64,110,255,0.38) 0%, rgba(64,110,255,0.12) 45%, rgba(64,110,255,0) 70%)",
          translate: interpolate(
            frame,
            [0, 90],
            ["-570px -330px", "-450px -405px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            },
          ),
          scale: interpolate(frame, [0, 90], [1, 1.14], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            output: "perceptual-scale",
          }),
        }}
      />

      {/* 炫光 2：右下紫色光晕，反方向漂移 */}
      <Interactive.Div
        name="Glow / 紫"
        style={{
          position: "absolute",
          width: 1230,
          height: 1230,
          borderRadius: "50%",
          filter: "blur(60px)",
          backgroundImage:
            "radial-gradient(circle, rgba(150,80,255,0.34) 0%, rgba(150,80,255,0.10) 45%, rgba(150,80,255,0) 70%)",
          translate: interpolate(
            frame,
            [0, 90],
            ["540px 360px", "450px 435px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            },
          ),
          scale: interpolate(frame, [0, 90], [1.12, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            output: "perceptual-scale",
          }),
        }}
      />

      {/* 炫光 3：标题正后方的高光，随标题一起亮起来 */}
      <Interactive.Div
        name="Glow / 标题高光"
        style={{
          position: "absolute",
          width: 1650,
          height: 480,
          borderRadius: "50%",
          filter: "blur(45px)",
          backgroundImage:
            "radial-gradient(ellipse, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)",
          opacity: interpolate(frame, [0, 24, 70, 90], [0, 0.9, 0.9, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [
              Easing.bezier(0.16, 1, 0.3, 1),
              Easing.linear,
              Easing.bezier(0.16, 1, 0.3, 1),
            ],
          }),
        }}
      />

      {/* 主标题：0-20 帧 spring 上浮淡入，70-90 帧淡出 */}
      <Interactive.Div
        name="Title"
        style={{
          position: "relative",
          fontFamily: FONT_FAMILY,
          fontSize: 100,
          fontWeight: 800,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          backgroundImage:
            "linear-gradient(100deg, #2B6CFF 0%, #6A4BFF 48%, #A855F7 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          opacity: interpolate(frame, [0, 20, 70, 90], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [
              Easing.bezier(0.16, 1, 0.3, 1),
              Easing.linear,
              Easing.bezier(0.16, 1, 0.3, 1),
            ],
          }),
          translate: interpolate(frame, [0, 20], ["0px 90px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
          }),
        }}
      >
        把性能诊断难题，交给一次对话
      </Interactive.Div>
    </AbsoluteFill>
  );
};
