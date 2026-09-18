/**
 * 全片色彩与调性（PLAN.md「全片色彩与调性」）
 * 直接抄 chat.html 的 light theme token，不另配一套。
 * 全片没有一帧黑底：镜头 1 用 SURFACE_2 打底，镜头 2 起升到 SURFACE_1。
 */

export const COLORS = {
  /** 画布底：纯白 --surface-1 */
  surface1: "#FFFFFF",
  /** 画布底：极浅灰 --surface-2，只有镜头 1 用 */
  surface2: "#F2F2F2",
  /** 分隔 / 网格线 --border-subtle */
  border: "rgba(0,0,0,0.07)",
  /** 主文字 --foreground */
  fg: "#191919",
  /** 次要文字 / 标注 --foreground-secondary */
  fgSecondary: "#777777",
  /** 主强调色：指针、进度、高亮 --ark-blue-500 */
  blue: "#4369EF",
  /** 主强调色的深端，只用来做渐变的另一头 */
  blueDeep: "#2E51D6",
  /** 引用标签蓝（# profile_dir 那种）--highlight-copy-blue-500 */
  quoteBlue: "#0B5BF4",
  /** 正向 / 达成 --ark-green-500 */
  green: "#04D793",
  /** 警示：只用在指针撞墙那一下 --ark-red-500 */
  red: "#FF4B7B",
  /** 打字机刚落笔的那一下（欢迎页点阵的紫端） */
  purple: "rgb(123,37,244)",
} as const;

/** 欢迎页点阵 --wzh-dots-rgb：靛 → 紫 */
export const DOTS_GRADIENT = ["rgb(99,102,241)", "rgb(123,37,244)"] as const;

/**
 * 全片「蓝条」的那一道轻微修饰渐变。
 * **标注胶囊（Callout）**用它 —— 指着界面说话时是纯蓝。
 */
export const BLUE_SHEEN = `linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.blueDeep} 100%)`;

/**
 * 左下角那张浮卡竖条的**蓝紫渐变**（v2 审片全片 1）。
 * 紫端就是欢迎页点阵和落版 slogan 用的那支紫，所以全片的紫只有一支。
 * ⚠️ 和 BLUE_SHEEN 别互换：蓝紫是「叙述者的声音」，纯蓝是「指着界面说话」。
 */
export const BLUE_PURPLE_SHEEN = `linear-gradient(180deg, ${COLORS.blue} 0%, ${DOTS_GRADIENT[1]} 100%)`;

/**
 * 泳道任务条的 6 个浅糖果色（BAR_COLORS）。
 * 镜头 1 / 2 / 8 里所有「一堆彩色元素」都从这里取色，
 * 抽象段和真实界面于是共用一套颜色，转场时看不到接缝。
 */
export const CANDY = [
  "#DBC8F7", // 紫
  "#FBC3E0", // 粉
  "#C0E6C7", // 绿
  "#C5D9FB", // 蓝
  "#FFDAB0", // 橙
  "#B9F0E3", // 青
] as const;

/**
 * 性能健康度（PHS）分数 → 颜色。
 *
 * 色标直接抄 `AI_Profiling_Tool/index_v3.html` 的 `gradeColorAt()`（浅色主题那只仪表盘），
 * 两端正好是全片已有的 --ark-red-500 和 --ark-green-500，所以配色是闭合的。
 * 仪表盘的指针尾迹逐段取色，于是「0 分红 → 100 分绿」是真的连续渐变。
 */
const PHS_STOPS: [number, [number, number, number]][] = [
  [0, [255, 75, 123]], // D  #FF4B7B
  [30, [255, 112, 81]], // C  #FF7051
  [45, [255, 151, 55]], // B  #FF9737
  [60, [233, 181, 27]], // B+ #E9B51B
  [75, [163, 203, 69]], // A  #A3CB45
  [90, [4, 215, 147]], // S  #04D793
  [100, [4, 215, 147]],
];

export const phsColorAt = (value: number): string => {
  const v = Math.max(0, Math.min(100, value));
  for (let i = 0; i < PHS_STOPS.length - 1; i++) {
    const [v0, c0] = PHS_STOPS[i];
    const [v1, c1] = PHS_STOPS[i + 1];
    if (v <= v1) {
      const t = (v - v0) / (v1 - v0 || 1);
      const ch = (k: number) => Math.round(c0[k] + (c1[k] - c0[k]) * t);
      return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
    }
  }
  return "rgb(4,215,147)";
};

export const FONT_FAMILY =
  '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';
