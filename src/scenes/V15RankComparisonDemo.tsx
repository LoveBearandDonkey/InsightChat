import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { COLORS, FONT_FAMILY } from "../theme";

type RankSample = {
  rank: number;
  node: string;
  stage: number;
  compute: number;
  communication: number;
  waiting: number;
  free: number;
};

const SAMPLE_DATA: RankSample[] = [
  { rank: 0, node: "node0", stage: 0, compute: 582, communication: 90, waiting: 90, free: 48 },
  { rank: 1, node: "node0", stage: 0, compute: 590, communication: 88, waiting: 80, free: 52 },
  { rank: 2, node: "node0", stage: 0, compute: 600, communication: 94, waiting: 92, free: 40 },
  { rank: 3, node: "node0", stage: 0, compute: 596, communication: 92, waiting: 251, free: 40 },
  { rank: 4, node: "node1", stage: 1, compute: 588, communication: 90, waiting: 104, free: 46 },
  { rank: 5, node: "node1", stage: 1, compute: 592, communication: 89, waiting: 99, free: 42 },
  { rank: 6, node: "node1", stage: 1, compute: 603, communication: 88, waiting: 92, free: 42 },
  { rank: 7, node: "node1", stage: 1, compute: 594, communication: 91, waiting: 105, free: 42 },
];

const SEGMENTS = [
  { key: "compute", label: "计算", color: COLORS.blue },
  { key: "communication", label: "通信", color: "#8B7CF6" },
  { key: "waiting", label: "等待", color: "#FFB547" },
  { key: "free", label: "Free", color: "#D8DDE7" },
] as const;

const totalOf = (row: RankSample) =>
  row.compute + row.communication + row.waiting + row.free;

const BASELINE_MS = 810;
const MAX_MS = 1050;

const MetricPill: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
}> = ({ label, value, accent = false }) => (
  <div
    style={{
      minWidth: 138,
      padding: "13px 18px",
      borderRadius: 16,
      border: `1px solid ${accent ? "rgba(255,75,123,0.24)" : COLORS.border}`,
      background: accent ? "rgba(255,75,123,0.06)" : "rgba(255,255,255,0.72)",
    }}
  >
    <div
      style={{
        color: COLORS.fgSecondary,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </div>
    <div
      style={{
        marginTop: 5,
        color: accent ? COLORS.red : COLORS.fg,
        fontSize: 27,
        fontWeight: 750,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
  </div>
);

const Legend: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
    {SEGMENTS.map((segment) => (
      <div
        key={segment.key}
        style={{ display: "flex", alignItems: "center", gap: 9 }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 4,
            background: segment.color,
          }}
        />
        <div style={{ color: COLORS.fgSecondary, fontSize: 17, fontWeight: 600 }}>
          {segment.label}
        </div>
      </div>
    ))}
    <div style={{ width: 1, height: 18, background: COLORS.border }} />
    <div style={{ color: COLORS.fgSecondary, fontSize: 15 }}>
      单位：ms / step
    </div>
  </div>
);

const RankRow: React.FC<{
  row: RankSample;
  index: number;
  barWidth: number;
}> = ({ row, index, barWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = totalOf(row);
  const anomalous = row.rank === 3;
  const enterAt = 20 + index * 4;
  const progress = spring({
    frame: frame - enterAt,
    fps,
    config: { damping: 22, mass: 0.7, stiffness: 120 },
    durationInFrames: 34,
  });
  const highlight = interpolate(frame, [58, 76, 94], [0, 1, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        height: 66,
        display: "grid",
        gridTemplateColumns: `160px ${barWidth}px 210px`,
        alignItems: "center",
        gap: 22,
        padding: "0 18px",
        borderRadius: 15,
        background: anomalous
          ? `rgba(255,75,123,${0.035 + highlight * 0.025})`
          : index % 2 === 0
            ? "rgba(67,105,239,0.025)"
            : "transparent",
        border: anomalous
          ? `1.5px solid rgba(255,75,123,${0.35 + highlight * 0.35})`
          : "1.5px solid transparent",
        opacity: interpolate(frame, [enterAt, enterAt + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `${interpolate(frame, [enterAt, enterAt + 18], [-22, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}px 0px`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div
          style={{
            width: 46,
            height: 38,
            borderRadius: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: anomalous ? COLORS.red : "rgba(67,105,239,0.10)",
            color: anomalous ? "white" : COLORS.blue,
            fontSize: 18,
            fontWeight: 760,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          R{row.rank}
        </div>
        <div>
          <div style={{ color: COLORS.fg, fontSize: 16, fontWeight: 680 }}>
            {row.node}
          </div>
          <div style={{ color: COLORS.fgSecondary, fontSize: 13, marginTop: 2 }}>
            PP stage {row.stage}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: barWidth,
          height: 34,
          display: "flex",
          alignItems: "stretch",
          borderRadius: 9,
          overflow: "hidden",
          background: "rgba(25,25,25,0.045)",
        }}
      >
        {SEGMENTS.map((segment, segmentIndex) => {
          const value = row[segment.key];
          return (
            <div
              key={segment.key}
              style={{
                width: (value / MAX_MS) * barWidth * progress,
                height: "100%",
                background: segment.color,
                borderLeft:
                  segmentIndex === 0 ? undefined : "2px solid rgba(255,255,255,0.68)",
                opacity: segment.key === "free" ? 0.82 : 1,
              }}
            />
          );
        })}

        {anomalous ? (
          <div
            style={{
              position: "absolute",
              left:
                ((row.compute + row.communication + row.waiting / 2) / MAX_MS) *
                barWidth,
              top: -1,
              translate: "-50% 0px",
              color: "#7A4A00",
              fontSize: 13,
              lineHeight: "34px",
              fontWeight: 760,
              opacity: interpolate(frame, [68, 82], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            等待 251
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end" }}>
        <div
          style={{
            color: anomalous ? COLORS.red : COLORS.fg,
            fontSize: 24,
            fontWeight: 760,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(total * progress)}
        </div>
        <div style={{ color: COLORS.fgSecondary, fontSize: 14, marginLeft: 6 }}>ms</div>
        <div
          style={{
            minWidth: 69,
            marginLeft: 12,
            padding: "5px 9px",
            borderRadius: 9,
            background: anomalous ? "rgba(255,75,123,0.10)" : "rgba(25,25,25,0.045)",
            color: anomalous ? COLORS.red : COLORS.fgSecondary,
            fontSize: 13,
            fontWeight: 680,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round((row.compute / total) * 100)}% 计算
        </div>
      </div>
    </div>
  );
};

export const RankComparisonChart: React.FC<{ data?: RankSample[] }> = ({
  data = SAMPLE_DATA,
}) => {
  const frame = useCurrentFrame();
  const barWidth = 1110;
  const baselineX = (BASELINE_MS / MAX_MS) * barWidth;

  return (
    <div
      style={{
        position: "relative",
        width: 1728,
        height: 692,
        borderRadius: 28,
        background: "rgba(255,255,255,0.94)",
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 24px 70px rgba(24,32,64,0.09)",
        padding: "24px 30px 26px",
        overflow: "hidden",
        opacity: interpolate(frame, [8, 24], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `0px ${interpolate(frame, [8, 28], [28, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}px`,
      }}
    >
      <div
        style={{
          height: 46,
          display: "grid",
          gridTemplateColumns: `160px ${barWidth}px 210px`,
          alignItems: "center",
          gap: 22,
          padding: "0 18px",
          color: COLORS.fgSecondary,
          fontSize: 14,
          fontWeight: 650,
        }}
      >
        <div>设备 / 拓扑</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>step 时间构成</span>
          <span>同一时间基线 · 0—{MAX_MS} ms</span>
        </div>
        <div style={{ textAlign: "right" }}>stepTime / 计算占比</div>
      </div>

      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            zIndex: 4,
            left: 18 + 160 + 22 + baselineX,
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: "2px dashed rgba(67,105,239,0.40)",
            opacity: interpolate(frame, [46, 62], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -8,
              left: 0,
              translate: "-50% -100%",
              padding: "5px 9px",
              borderRadius: 8,
              background: "rgba(67,105,239,0.09)",
              color: COLORS.blue,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            健康基线 {BASELINE_MS} ms
          </div>
        </div>

        {data.map((row, index) => (
          <RankRow key={row.rank} row={row} index={index} barWidth={barWidth} />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          bottom: 14,
          height: 48,
          padding: "0 16px",
          borderRadius: 14,
          background: "#FFF8EC",
          border: "1px solid rgba(255,181,71,0.38)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity: interpolate(frame, [72, 86], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: `${interpolate(frame, [72, 86], [12, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px 0px`,
        }}
      >
        <div
          style={{
            padding: "5px 9px",
            borderRadius: 8,
            background: "rgba(255,181,71,0.20)",
            color: "#7A4A00",
            fontSize: 13,
            fontWeight: 760,
          }}
        >
          自动洞察
        </div>
        <div style={{ color: "#7A4A00", fontSize: 14, fontWeight: 760 }}>
          瓶颈落在等待段
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(122,74,0,0.18)" }} />
        <div style={{ color: "#8A6735", fontSize: 13 }}>
          Rank 3 比健康基线多出 169 ms，其中等待时间贡献约 95%；优先检查 stage 同步与上游负载不均。
        </div>
      </div>
    </div>
  );
};

export const V15RankComparisonDemo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 80% -20%, rgba(67,105,239,0.12), transparent 36%), linear-gradient(180deg, #F8F9FC 0%, #F2F4F8 100%)",
        fontFamily: FONT_FAMILY,
        color: COLORS.fg,
        padding: "70px 96px 58px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          opacity: interpolate(frame, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: `0px ${interpolate(frame, [0, 18], [18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px`,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                background: "rgba(67,105,239,0.11)",
                color: COLORS.blue,
                fontSize: 15,
                fontWeight: 760,
                letterSpacing: 1,
              }}
            >
              TOP 1 · V15
            </div>
            <div style={{ color: COLORS.fgSecondary, fontSize: 17 }}>
              报告高频模块可视化示意
            </div>
          </div>
          <div style={{ fontSize: 50, fontWeight: 780, letterSpacing: -1, marginTop: 14 }}>
            Rank 级横向对比
          </div>
          <div style={{ color: COLORS.fgSecondary, fontSize: 20, marginTop: 8 }}>
            统一时间基线，定位拖慢整步的异常卡与阻塞来源
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <MetricPill label="集群中位数" value="825 ms" />
          <MetricPill label="异常 Rank" value="Rank 3" accent />
          <MetricPill label="额外耗时" value="+169 ms" accent />
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <RankComparisonChart />
      </div>

      <div
        style={{
          position: "absolute",
          left: 126,
          bottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Legend />
        <div
          style={{
            padding: "5px 9px",
            borderRadius: 8,
            background: "rgba(25,25,25,0.045)",
            color: COLORS.fgSecondary,
            fontSize: 13,
          }}
        >
          示意数据
        </div>
      </div>
    </AbsoluteFill>
  );
};
