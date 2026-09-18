import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_FAMILY } from "../theme";
import {
  FPS,
  shotBaseFrames,
  ShotSpec,
  shotStartFrame,
  SHOTS,
  TOTAL_FRAMES,
} from "../shots";

/**
 * D2 骨架用的占位块：纯色 + 一行标题 + 旁白字幕 + 本镜进度。
 * 验收标准是「很丑但节奏是对的」—— 空格播一遍，看旁白念不念得完、哪镜太挤。
 * D4/D5 逐个把 src/scenes/ShotN*.tsx 的 <ShotPlaceholder> 换成真内容。
 */
export const ShotPlaceholder: React.FC<{ shot: ShotSpec }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const i = SHOTS.findIndex((s) => s.n === shot.n);
  const start = shotStartFrame(i);

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fmt = (f: number) =>
    `0:${String(Math.floor(f / FPS)).padStart(2, "0")}`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: shot.n === 1 ? COLORS.surface2 : COLORS.surface1,
        fontFamily: FONT_FAMILY,
        color: COLORS.fg,
        padding: 96,
        justifyContent: "center",
      }}
    >
      {/* 本镜主色块：先占住画面，D4/D5 再换成真镜头 */}
      <AbsoluteFill
        style={{
          backgroundColor: shot.accent,
          opacity: 0.35,
          left: "auto",
          width: 420,
        }}
      />

      {/* 左上：镜号 / 小标题 / 时间码 */}
      <div style={{ position: "absolute", top: 96, left: 96 }}>
        <div style={{ fontSize: 200, fontWeight: 800, lineHeight: 1 }}>
          {String(shot.n).padStart(2, "0")}
        </div>
        <div style={{ fontSize: 44, fontWeight: 600, marginTop: 12 }}>
          {shot.name}
        </div>
        <div
          style={{
            fontSize: 28,
            color: COLORS.fgSecondary,
            marginTop: 8,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt(start)}–{fmt(start + shotBaseFrames(i))} · {shot.seconds}s ·{" "}
          {shot.source}
        </div>
      </div>

      {/* 中部：一句话镜头 + 屏幕字 */}
      <div style={{ maxWidth: 1180, marginTop: 120 }}>
        <div style={{ fontSize: 40, lineHeight: 1.5 }}>{shot.line}</div>
        <div
          style={{
            fontSize: 30,
            marginTop: 28,
            color: COLORS.blue,
            fontWeight: 600,
          }}
        >
          屏幕字：{shot.screen}
        </div>
      </div>

      {/* 底部：旁白字幕，用来核 4~4.5 字/秒 */}
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          bottom: 128,
          fontSize: 34,
          lineHeight: 1.6,
          color: COLORS.fgSecondary,
        }}
      >
        {shot.vo}
        <span style={{ marginLeft: 16, fontSize: 26 }}>
          （{shot.vo.replace(/[^一-龥]/g, "").length} 字 /{" "}
          {shot.seconds}s）
        </span>
      </div>

      {/* 底边：本镜进度 + 全片位置 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          backgroundColor: COLORS.border,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: COLORS.blue,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          right: 96,
          bottom: 40,
          fontSize: 24,
          color: COLORS.fgSecondary,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {shot.n} / {SHOTS.length} · 全片 {Math.round(TOTAL_FRAMES / FPS)}s
      </div>
    </AbsoluteFill>
  );
};
