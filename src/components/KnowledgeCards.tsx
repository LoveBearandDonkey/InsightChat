import { spring } from "remotion";
import { CANDY, COLORS, FONT_FAMILY } from "../theme";
import { GAUGE_CENTER } from "./Gauge";

/**
 * 镜头 2 的知识与技能卡片：12 张，分三层从画幅四周汇入仪表盘背后。
 *
 * 分工照分镜细表：
 *   · 前 4 张停最久、标题清晰可读 —— 负责「内容可信」；
 *   · 后 8 张只露短标签、小而半透 —— 负责「经验规模」。
 * 别让观众把十二张全读完，那不是这一秒要干的事。
 *
 * ⚠️ v2 审片局部 5：「知识库卡片就位到仪表盘旁边停住后，**再**第二次动画往仪表盘背后聚拢，
 * 让指针从 75 突破到 92 时，看上去是知识库『被集成』导致的」。
 * 所以入场分成两拍，各自一个 prop：
 *   第一拍 `land`（组件内部按 enterAt 算）—— 飞进来，**停在盘两侧，读得清**；
 *   第二拍 `gather`（外面传）—— 整组收拢、缩小、沉到盘背后；
 *   第三拍 `absorb` —— 盘面形变成 logo 时把剩下的一起吸进圆心。
 * 指针的蓄力和破墙**接在第二拍之后**，因果关系才成立。
 */

export type CardSpec = {
  id: number;
  title: string;
  /** 前排卡才有的副行 */
  sub?: string;
  /** 落位相对仪表盘圆心的偏移 */
  dx: number;
  dy: number;
  w: number;
  h: number;
  scale: number;
  rot: number;
  opacity: number;
  candy: string;
  enterAt: number;
  front: boolean;
};

const FRONT = [
  { title: "msprof-analyze 集群 recipe", sub: "8 个 recipe · advisor all" },
  { title: "昇腾性能调优手册", sub: "训练 / 推理 / 算子 / 系统" },
  { title: "集群分析 Case Library", sub: "慢卡 · 慢链路 · 切分不均" },
  { title: "算子亲和度基线", sub: "cube 利用率 · MFU 基线" },
];

const FRONT_POS = [
  { dx: -648, dy: -196 },
  { dx: -676, dy: 34 },
  { dx: 648, dy: -196 },
  { dx: 676, dy: 34 },
];

const BACK = [
  "慢卡诊断",
  "通信分析",
  "并行切分",
  "内存优化",
  "算子调优",
  "降频排查",
  "Host 下发",
  "服务化性能",
];

export const CARDS: CardSpec[] = ([] as CardSpec[]).concat(
  FRONT.map(
    (c, i): CardSpec => ({
      id: i,
      title: c.title,
      sub: c.sub,
      dx: FRONT_POS[i].dx,
      dy: FRONT_POS[i].dy,
      w: 386,
      h: 116,
      scale: 1,
      rot: (i % 2 === 0 ? -1 : 1) * (2 + i * 0.6),
      opacity: 1,
      candy: CANDY[i % CANDY.length],
      // 前排后到、停得久：入场晚一点，观众的眼睛才落得住。
      // v2 局部 5：全部要在第 44 帧前落定（之后才是「聚拢」那一拍），所以比上一版早一档
      enterAt: 6 + i * 4,
      front: true,
    }),
  ),
  BACK.map((title, i): CardSpec => {
    // 后排 8 张沿椭圆环绕盘背，大半被盘面挡住，只露出边角 —— 那是「厚度」
    const a = (-90 + i * 45) * (Math.PI / 180);
    return {
      id: 100 + i,
      title,
      dx: Math.cos(a) * 336,
      dy: Math.sin(a) * 214,
      w: 206,
      h: 66,
      scale: 0.62 + (i % 3) * 0.07,
      rot: Math.cos(a) * 7,
      opacity: 0.62,
      candy: CANDY[(i + 2) % CANDY.length],
      enterAt: i * 2,
      front: false,
    };
  }),
);

/**
 * @param f      镜头 2 的本镜帧
 * @param gather 0–1，第二拍：整组从盘两侧**收拢到盘背后**（v2 局部 5）
 * @param absorb 0–1，第三拍：盘面形变成 logo 时把卡片一起吸进圆心
 */
export const KnowledgeCards: React.FC<{
  f: number;
  fps: number;
  gather?: number;
  absorb: number;
}> = ({ f, fps, gather = 0, absorb }) => (
  <>
    {CARDS.map((c) => {
      const land = spring({
        frame: f - c.enterAt,
        fps,
        durationInFrames: 24,
        config: { damping: 200 },
      });
      if (land <= 0.001) {
        return null;
      }
      // 入场起点：沿离心方向甩到画幅外
      const len = Math.max(1, Math.sqrt(c.dx * c.dx + c.dy * c.dy));
      const fromX = c.dx + (c.dx / len) * 780;
      const fromY = c.dy + (c.dy / len) * 520;
      // 第二拍：往盘心收 74%，正好落到盘面背后；同时缩小、压暗，让出主角位
      const pull = 1 - 0.74 * gather;
      const dx = (fromX + (c.dx - fromX) * land) * pull * (1 - absorb);
      const dy = (fromY + (c.dy - fromY) * land) * pull * (1 - absorb);
      const scale =
        c.scale * (0.82 + 0.18 * land) * (1 - 0.34 * gather) * (1 - absorb * 0.85);
      const rot = c.rot * (1 - land) * 3 + c.rot * land;
      const opacity =
        c.opacity * land * (1 - 0.55 * gather) * (1 - absorb);

      return (
        <div
          key={c.id}
          style={{
            position: "absolute",
            left: GAUGE_CENTER.x + dx - c.w / 2,
            top: GAUGE_CENTER.y + dy - c.h / 2,
            width: c.w,
            height: c.h,
            opacity,
            transform: `scale(${scale}) rotate(${rot}deg)`,
            background: COLORS.surface1,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 14,
            boxShadow: c.front
              ? "0 14px 34px rgba(0,0,0,0.10)"
              : "0 8px 20px rgba(0,0,0,0.07)",
            display: "flex",
            alignItems: "center",
            gap: c.front ? 14 : 10,
            padding: c.front ? "0 20px" : "0 14px",
            fontFamily: FONT_FAMILY,
            overflow: "hidden",
          }}
        >
          {/* 糖果色页签 */}
          <div
            style={{
              width: c.front ? 6 : 4,
              height: c.front ? 62 : 34,
              borderRadius: 3,
              background: c.candy,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: c.front ? 25 : 20,
                fontWeight: 600,
                color: COLORS.fg,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.title}
            </div>
            {c.sub ? (
              <div
                style={{
                  fontSize: 17,
                  marginTop: 7,
                  color: COLORS.fgSecondary,
                  whiteSpace: "nowrap",
                }}
              >
                {c.sub}
              </div>
            ) : null}
          </div>
        </div>
      );
    })}
  </>
);
