import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_FAMILY } from "../theme";
import { UI } from "./RecordingScreen";

/**
 * 镜头 8 后半：欢迎页的三张牵引卡长成一面场景卡片墙，再收拢成落版。
 *
 * 「更多场景」这件事只能靠**数量**说，所以做法和镜头 2 的知识卡是同一套：
 * 真实的三张先在原位接上（坐标就是 UI.card1/2/3，和录屏里那三张严丝合缝），
 * 其余十二张从它们身后长出去铺满画幅。
 *
 * ⚠️ 审片意见（局部 18 / 19）落在这里：
 *   · 三张牵引卡浮出后要在**画面 C 位**，不是挤在右侧 —— 网格改 5 列 × 3 行，
 *     种子卡占正中那一行的中间三格（slot 6/7/8），横排居中；
 *   · **去掉第二行的蓝色标签**（`Profiling数据` / `快慢卡` 那种）；
 *   · 卡片左上角图标改用 `public/guidecard1~3.png` 循环填充，不再是随机糖果色方块；
 *   · 其余场景卡除了标题，**也要补一句话描述**，随标题一起出现。
 *
 * ⚠️ 这一层画在 CameraShot **外面**，画幅坐标就是屏幕坐标。
 * 能这么干的前提是镜头在 SETTLE 帧已经回到 scale 1 / 焦点正中（见 Shot8Finale 的 CAM_OUT），
 * 三张种子卡才对得上录屏里那三张的落位。改 CAM_OUT 就要一起改这里。
 */

type Card = { title: string; sub: string };

/** 前三张 = 录屏里真有的三张牵引卡，文案照抄页面，不要改写 */
const SEEDS: Card[] = [
  { title: "内存优化诊断分析", sub: "智能分析复用策略与分块方案" },
  { title: "快慢卡诊断分析", sub: "快速对比通信 / 计算差异并定位慢卡" },
  { title: "咨询领域知识，增强RAG的对话", sub: "输入问题，检索知识库并生成排查步骤" },
];

/** 后十二张 = 分镜细表点名的那几个场景，加几个同量级的。每张都带一句话描述 */
const MORE: Card[] = [
  { title: "算子融合", sub: "把碎算子合并，省下反复的搬入搬出" },
  { title: "通信掩盖", sub: "让通信藏进计算，压掉暴露出来的等待" },
  { title: "慢卡定位", sub: "从 8 卡里找出那张拖后腿的" },
  { title: "降频排查", sub: "对齐频率曲线，看是不是热了才慢" },
  { title: "Host 下发", sub: "查下发是否跟得上，别让 NPU 空等" },
  { title: "显存碎片", sub: "看碎片从哪来，给出复用与分块建议" },
  { title: "并行切分", sub: "TP / PP / DP 怎么切，负载才均" },
  { title: "算子亲和度", sub: "cube 利用率对不对得上基线" },
  { title: "服务化性能", sub: "首 token 与吞吐，分别卡在哪一段" },
  { title: "流水 bubble", sub: "PP 级间的空泡有多大，怎么填" },
  { title: "长尾算子", sub: "耗时排在最后那几个，值不值得改" },
  { title: "多机扩展性", sub: "从单机到多机，效率掉在哪一跳" },
];

/** 5 列 × 3 行铺满画幅 */
const COLS = 5;
const CARD_W = 336;
const CARD_H = 168;
const GAP_X = 26;
const GAP_Y = 26;
const LEFT = (1920 - (COLS * CARD_W + (COLS - 1) * GAP_X)) / 2;
const TOP = 214;

const slot = (i: number) => ({
  x: LEFT + (i % COLS) * (CARD_W + GAP_X),
  y: TOP + Math.floor(i / COLS) * (CARD_H + GAP_Y),
  w: CARD_W,
  h: CARD_H,
});

/** 三张种子卡占**正中那一行的中间三格** —— 浮出后就在 C 位（审片局部 18） */
const SEED_SLOTS = [6, 7, 8];
const MORE_SLOTS = [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14];
const SEED_FROM = [UI.card1, UI.card2, UI.card3];

/** 卡片图标：欢迎页那三枚引导图标，循环填充到所有卡上 */
const GUIDE_ICONS = ["guidecard1.png", "guidecard2.png", "guidecard3.png"];

/** 收拢的目标点：落版 logo 的位置 */
const COLLAPSE_TO = { x: 960, y: 392 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const CardFace: React.FC<{
  card: Card;
  icon: string;
  /** 卡面尺寸，种子卡在位移途中会从录屏那张的尺寸渐变成格子尺寸 */
  w: number;
  h: number;
  /** 文字随卡片缩小一起淡掉，收拢时才不糊成一团 */
  textOpacity: number;
  /** 一句话描述比标题晚一点点出现 */
  subOpacity: number;
}> = ({ card, icon, w, h, textOpacity, subOpacity }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 16,
      background: "#FFFFFF",
      border: `1px solid ${COLORS.border}`,
      boxShadow: "0 10px 28px rgba(0,0,0,0.07)",
      padding: "24px 26px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      overflow: "hidden",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: textOpacity }}>
      <Img
        src={staticFile(icon)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          objectFit: "contain",
        }}
      />
      <div
        style={{
          fontSize: 25,
          fontWeight: 600,
          color: COLORS.fg,
          lineHeight: 1.2,
        }}
      >
        {card.title}
      </div>
    </div>
    <div
      style={{
        fontSize: 19,
        lineHeight: 1.4,
        color: COLORS.fgSecondary,
        opacity: textOpacity * subOpacity,
      }}
    >
      {card.sub}
    </div>
  </div>
);

export const CardWall: React.FC<{
  /** 本镜帧号 */
  frame: number;
  /** 三张种子卡出现（此刻镜头必须已回到 scale 1） */
  seed: number;
  /** 开始铺开成墙 */
  grow: number;
  /** 开始收拢 */
  collapse: number;
}> = ({ frame, seed, grow, collapse }) => {
  const { fps } = useVideoConfig();
  if (frame < seed) {
    return null;
  }

  // 收拢：整面墙一起向 logo 位置塌缩 + 轻微旋转
  const fold = spring({
    frame: frame - collapse,
    fps,
    durationInFrames: 22,
    config: { damping: 200 },
  });

  const cards = [
    ...SEEDS.map((card, i) => ({ card, i, isSeed: true, slotIndex: SEED_SLOTS[i] })),
    ...MORE.map((card, i) => ({ card, i, isSeed: false, slotIndex: MORE_SLOTS[i] })),
  ];

  return (
    <>
      {cards.map(({ card, i, isSeed, slotIndex }) => {
        const target = slot(slotIndex);
        // 种子卡：从录屏里那张的位置和尺寸挪进正中那三格
        // ⚠️ v2 局部 14 之后整面墙要在 150 帧前长完（收拢 158、slogan 172 起打），
        // 所以种子卡的位移和后排的错落都比上一版短一档
        const move = isSeed
          ? spring({
              frame: frame - grow - i * 2,
              fps,
              durationInFrames: 20,
              config: { damping: 200 },
            })
          : 1;
        const from = isSeed ? SEED_FROM[i] : target;
        const x = from.x + (target.x - from.x) * move;
        const y = from.y + (target.y - from.y) * move;
        const w = from.w + (target.w - from.w) * move;
        const h = from.h + (target.h - from.h) * move;

        // 后十二张：从中间那三张身后依次长出来。
        // 错落 1.6 → 0.6 帧、spring 20 → 15 帧：最后一张也在 grow+21 帧落定
        const bornAt = grow + 5 + i * 0.6;
        const born = isSeed
          ? interpolate(frame - seed, [0, 6], [0, 1], clamp)
          : spring({
              frame: frame - bornAt,
              fps,
              durationInFrames: 15,
              config: { damping: 200 },
            });
        // 一句话描述跟在标题后面几帧出现（审片局部 19：随标题出现）
        const subIn = isSeed
          ? interpolate(frame - seed, [4, 14], [0, 1], clamp)
          : interpolate(frame - bornAt, [4, 13], [0, 1], clamp);

        const cx = x + w / 2;
        const cy = y + h / 2;
        const foldScale = 1 - fold * 0.94;
        const fx = cx + (COLLAPSE_TO.x - cx) * fold;
        const fy = cy + (COLLAPSE_TO.y - cy) * fold;
        const opacity = born * (1 - interpolate(fold, [0.45, 1], [0, 1], clamp));
        if (opacity <= 0.002) {
          return null;
        }

        // 后排卡从中心那三格向外「推」出来，方向就是它离中心的方向
        const outward = isSeed ? 0 : (target.x + target.w / 2 - 960) / 12;

        return (
          <div
            key={card.title}
            style={{
              position: "absolute",
              left: fx - w / 2,
              top: fy - h / 2,
              opacity,
              fontFamily: FONT_FAMILY,
              transform: [
                `scale(${(0.9 + born * 0.1) * foldScale})`,
                `rotate(${fold * (i % 2 ? 8 : -8)}deg)`,
                `translateX(${(1 - born) * outward}px)`,
              ].join(" "),
            }}
          >
            <CardFace
              card={card}
              icon={GUIDE_ICONS[i % GUIDE_ICONS.length]}
              w={w}
              h={h}
              textOpacity={interpolate(fold, [0, 0.35], [1, 0], clamp)}
              subOpacity={subIn}
            />
          </div>
        );
      })}
    </>
  );
};

/**
 * 落版。**纯白底、产品名 #191919、slogan 打字机紫 → 蓝** —— 全片最亮的一帧收在这里，
 * 别在落版处忽然转深色（PLAN.md D6 第一条）。
 * logo 用 public/logo.png（svg 那版引用了不存在的 mask，只渲染得出一小块）。
 */
export const Lockup: React.FC<{
  frame: number;
  enter: number;
  children: React.ReactNode;
}> = ({ frame, enter, children }) => {
  const { fps } = useVideoConfig();
  const rise = spring({
    frame: frame - enter,
    fps,
    durationInFrames: 26,
    config: { damping: 200 },
  });
  if (rise <= 0.002) {
    return null;
  }
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_FAMILY,
        opacity: rise,
        transform: `scale(${interpolate(rise, [0, 1], [0.92, 1], {
          easing: Easing.out(Easing.cubic),
        })})`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * 落版那句 slogan 的打字机。
 * 审片意见（局部 20）：**不要句号**；要有打字出来的感觉；
 * 刚打出来的那个字是紫的，再快速渐变到现在的蓝。
 */
export const TypedSlogan: React.FC<{
  text: string;
  /** 本镜帧 */
  frame: number;
  /** 第一个字落下的帧 */
  enter: number;
  /** 每个字之间隔几帧 */
  perChar?: number;
  /** 紫 → 蓝走几帧 */
  settle?: number;
  size?: number;
}> = ({ text, frame, enter, perChar = 2, settle = 10, size = 36 }) => {
  const chars = Array.from(text);
  return (
    <div
      style={{
        marginTop: 26,
        fontSize: size,
        letterSpacing: 4,
        fontFamily: FONT_FAMILY,
        display: "flex",
        justifyContent: "center",
        whiteSpace: "pre",
      }}
    >
      {chars.map((ch, i) => {
        const at = enter + i * perChar;
        if (frame < at) {
          return null;
        }
        // 刚落笔是紫的，settle 帧内渐变到全片主蓝
        const t = interpolate(frame, [at, at + settle], [0, 1], clamp);
        const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
        return (
          <span
            key={i}
            style={{
              color: `rgb(${mix(123, 67)},${mix(37, 105)},${mix(244, 239)})`,
              // 落笔那一下轻轻往上顶一点，才有「敲出来」的手感
              transform: `translateY(${(1 - t) * 5}px)`,
              display: "inline-block",
              opacity: interpolate(frame, [at, at + 3], [0, 1], clamp),
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};
