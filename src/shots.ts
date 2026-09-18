import { CANDY } from "./theme";

/**
 * 分镜表（PLAN.md 二 · D2「写分镜表」）的唯一数据源。
 * 骨架、字幕、总时长全部从这里算出来，改节奏只改这一处。
 */

export const FPS = 30;

/** 转场时长。转场是「重叠」而不是「插空」，所以要从两侧场景各借一半回来 */
export const TRANSITION_FRAMES = 16;

/**
 * Remotion 4.0.513 的 @remotion/transitions 没有 cube()。
 * ⚠️ v2 审片局部 7「9~10 秒那个翻转页面完全不需要」—— 说的就是 2 → 3 那一刀的 flip()。
 * **现在全片一次 flip 都不用了**，类型留着以防以后要回。
 */
export type TransitionKind = "flip" | "slide" | "fade";

export type ShotSpec = {
  /** 镜号 */
  n: number;
  /** 组件 / Composition id 用的短名 */
  key: string;
  /** 中文小标题 */
  name: string;
  /** 分镜表里的时长（秒） */
  seconds: number;
  /** 一句话镜头 */
  line: string;
  /** 旁白 */
  vo: string;
  /** 屏幕字 */
  screen: string;
  /** 素材来源 */
  source: string;
  /** 本镜主色，取自泳道糖果色 */
  accent: string;
  /**
   * 接到「下一镜」的转场；null = 硬切。
   * 现在全片只有 fade（1→2、2→3、7→8）和 slide（6→7）；
   * 5 → 6 必须硬切 —— 插了转场，「一去一回」就断了。
   */
  transitionAfter: TransitionKind | null;
};

export const SHOTS: ShotSpec[] = [
  {
    n: 1,
    key: "Dilemma",
    name: "困局",
    seconds: 4,
    line: "图表洪流翻滚收拢成仪表盘，指针撞墙反弹停在 75",
    vo: "一次采集，8 张卡，几十万行算子。答案就在这里面 —— 可找到它，靠的是经验",
    screen: "虽有很多数据，但依然苦于得到关键判断",
    source: "纯代码",
    accent: CANDY[3],
    transitionAfter: "fade",
  },
  {
    n: 2,
    key: "Expertise",
    name: "专家经验入场，工具现形",
    seconds: 6,
    line: "十二张知识卡汇入盘背，指针破墙扫满；盘形变 logo，脉络贯通整个性能工作台",
    vo: "现在，昇腾性能调优的专家经验，长进了工具里",
    screen: "昇腾性能专家经验，现已集成进了工具知识库",
    source: "纯代码 + 截图",
    accent: CANDY[2],
    // v2 局部 7：原来是 flip()（那个「翻转页面」）。改成 fade —— 镜头继续往输入框推，
    // 画面交叉溶解过去，「直接继续聚焦到输入框」。总帧数不受影响（半个转场两边对消）
    transitionAfter: "fade",
  },
  {
    n: 3,
    key: "Context",
    name: "把整个采集目录带进对话",
    seconds: 8,
    line: "锚定 chip profile_dir → 敲 # 选整个采集目录 → 打出那 4 行提问 → 发送",
    vo: "一个 #，整个采集目录、8 张卡的落盘，全进了对话。剩下的，只管把要求说清楚",
    screen: "一个 # 号，把关键对象带入上下文",
    source: "录屏 + JSX 重绘",
    accent: CANDY[5],
    transitionAfter: null,
  },
  {
    n: 4,
    key: "Ask",
    name: "发问",
    seconds: 3,
    line: "问题卡片吸顶夹成 3 行，会话主题行冒出，输入框描边跑马流光",
    vo: "原本两天的排查，交给一次提问",
    screen: "把原本 1~2 天的性能诊断，交给 1 次对话",
    source: "录屏",
    accent: CANDY[4],
    transitionAfter: null,
  },
  {
    n: 5,
    key: "Reasoning",
    name: "推理可见 + 反向定位（对话 → 图）",
    seconds: 10,
    line: "思考竖轨 7 个节点逐个点亮 → 报告流式吐出 → 点结论锚点，折叠分组自动展开定位闪光",
    vo: "它查了什么、排除了什么、凭哪张表下的结论，一步步摊开给你看。而每条结论，都能点回图上那一行",
    screen: "它查了什么、排除了什么，一步步摊开",
    source: "JSX 重绘 + 录屏",
    accent: CANDY[0],
    // 5 → 6 硬切：同一个镜位连着走，「来回」才成立
    transitionAfter: null,
  },
  {
    n: 6,
    key: "Backflow",
    name: "图 → 对话，以及不打断的节奏",
    seconds: 6,
    line: "泳道条右键「智能分析」丢进输入框 → 两条排队 → 队列 z 轴下沉收起 → 跳动气泡一键置底",
    vo: "图上看到可疑的，右键丢进来。不用等它答完，它替你排好队",
    screen: "尽情提问，问题会自己排好队",
    source: "录屏",
    accent: CANDY[1],
    transitionAfter: "slide",
  },
  {
    n: 7,
    key: "Partner",
    name: "换个搭档",
    // 3.5s：从这一镜借出的 0.5s 全给镜头 8 的「已回答页面停留」（审片局部 17）
    seconds: 3.5,
    line: "侧视角点开 Agent 弹层 → 选 DeepSeek，品牌行 / 头像 / 模型按钮三处同时换脸",
    vo: "你用惯的 Agent，也能进来一起干活",
    screen: "把更多你惯用的 Agent 拉入伙协作",
    source: "JSX 重绘",
    accent: CANDY[4],
    transitionAfter: "fade",
  },
  {
    n: 8,
    key: "Finale",
    name: "场景与落版",
    /**
     * 8.2s。7 → 8 之间借来的 0.5s 用在「答完的页面停住」，
     * v2 之后又**往后加了 0.7s**（全片 48 → 48.7s）——
     * 因为尾巴上三件事互相挤不动了：卡片墙至少停 0.5s、slogan 要打完、打完还要定格 1s。
     *
     * ⚠️ 加长的是**片尾**，BGM 仍从第 0 帧（正片时间轴）对齐播完 48s，
     * 所以 18s 前副歌、31s 副歌起、43s 收束层压在哪一刀上，一帧没变。
     * 音乐在正片 48s 处收干净，最后 0.7s 是落版定格 —— 音乐先落，画面后收。
     */
    seconds: 8.2,
    line: "答完停住 → 新建对话 → 欢迎页打字机 + 三张牵引卡 → 场景卡片墙 → 收拢落版",
    vo: "更多性能调优场景，等你和它一起解锁",
    screen: "MS Insight 智能助手 / 从数据到证据，从结论回到现场",
    source: "录屏 + 纯代码",
    accent: CANDY[0],
    transitionAfter: null,
  },
];

/**
 * 一镜的「净」帧数（不含转场借来的那两个半截）。
 *
 * ⚠️ 必须 `Math.round` —— `seconds` 现在有小数（镜头 7 是 3.5、镜头 8 是 8.2），
 * 而 `8.2 * 30` 在浮点里是 245.99999999999997，
 * Remotion 的 `durationInFrames` 只吃整数，会直接报错。
 */
export const shotBaseFrames = (i: number): number =>
  Math.round(SHOTS[i].seconds * FPS);

/**
 * 场景在 TransitionSeries 里要申报的帧数。
 * 转场吃掉两侧各一半，先加回来，分镜表上的 0:00–0:04 这类时间码才对得上。
 */
export const shotFrames = (i: number): number => {
  const half = TRANSITION_FRAMES / 2;
  const inTransition = i > 0 && SHOTS[i - 1].transitionAfter ? half : 0;
  const outTransition = SHOTS[i].transitionAfter ? half : 0;
  return shotBaseFrames(i) + inTransition + outTransition;
};

const TRANSITION_COUNT = SHOTS.filter((s) => s.transitionAfter).length;

/**
 * 全片总帧数 = 各镜时长之和 × 30（转场是重叠的，加回去的半个转场两边对消）。
 * 现在是 **48.7s = 1461 帧**：镜头 8 为了「卡片墙停满 0.5s + slogan 打完 + 定格 1s」加长了 0.7s。
 * ⚠️ BGM 仍是 48.00s，从正片第 0 帧起播 —— 段落时间码全部照旧，
 * 多出来的 0.7s 落在片尾，是音乐收完之后的定格。
 */
export const TOTAL_FRAMES =
  SHOTS.reduce((sum, _, i) => sum + shotFrames(i), 0) -
  TRANSITION_COUNT * TRANSITION_FRAMES;

/** 每镜的起始帧，字幕和「第几秒」核对用 */
export const shotStartFrame = (i: number): number =>
  SHOTS.slice(0, i).reduce((sum, _s, k) => sum + shotBaseFrames(k), 0);

/**
 * 本镜在 TransitionSeries 里「前面」被转场借走的帧数。
 * 场景内部计时要减掉它，才能和分镜细表上的 0.0s 对齐（见 useShotFrame）。
 */
export const shotInPad = (i: number): number =>
  i > 0 && SHOTS[i - 1].transitionAfter ? TRANSITION_FRAMES / 2 : 0;
