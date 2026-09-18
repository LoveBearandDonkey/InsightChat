import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import { CameraPose, CameraShot } from "./CameraShot";

/**
 * 录屏铺进画幅 + 镜头运动的地基（PLAN.md D5「功能段」）。
 *
 * 素材是 2880×1800（16:10），成片是 1920×1080（16:9）。
 * 等宽铺满就是 1920×1200，上下各溢出 60px —— 正好等于录制手册说的「裁 16:9 上下各切 90px」。
 * 于是**画幅坐标 = 屏幕坐标**：量图时把 2880 宽的截图等比缩到 1920，再把 y 减 60 就是这里的数。
 */
export const SCREEN = {
  width: 1920,
  height: 1200,
  /** 录屏在画幅坐标里的上下边界 */
  top: -60,
  bottom: 1140,
} as const;

/**
 * 界面区域（画幅坐标）。量自 A段 / D+E段 / F段 / C段 ——
 * 四段都是 Chrome 100%、同一套版面，所以一份坐标四镜通用。换素材才需要重量。
 */
export const UI = {
  /** 右侧对话面板整体 */
  panel: { x: 1274, y: 0, w: 626, h: 1084 },
  /** 输入框外框 */
  input: { x: 1298, y: 868, w: 587, h: 228 },
  /** 输入框上方的目录锚定 chip：📁 profile_dir */
  chip: { x: 1312, y: 896, w: 120, h: 32 },
  /** 发送键圆心 */
  send: { x: 1853, y: 1073, r: 26 },
  /** `#` 弹出的上下文选择框，以及它的第一条（整个采集目录，8 卡） */
  picker: { x: 1293, y: 562, w: 589, h: 358 },
  pickerFirstRow: { x: 1293, y: 594, w: 589, h: 52 },
  /**
   * 提问三处要「局部提亮」的词（分镜细表镜头 3）。坐标是**四行打满之后**的落位。
   *
   * ⚠️ 输入框向上长高，底边不动 —— 所以每加一行，上面几行都会整体上移一档（约 28px）。
   * 「打完那个词的同一帧就提亮」在几何上是不成立的：那一瞬间行还在旧位置，下一帧就跳走了。
   * 所以镜头 3 把三处提亮挪到四行全部打完、版面稳住之后，发送之前连点三下。
   */
  askWords: {
    evidence: { x: 1680, y: 983, w: 82, h: 34 },
    health: { x: 1555, y: 1011, w: 100, h: 34 },
    priority: { x: 1470, y: 1039, w: 66, h: 34 },
  },
  /** 镜头 4：吸顶的问题卡片、卡片上的锚点标签、标题栏下冒出的会话主题行 */
  askCard: { x: 1300, y: 127, w: 590, h: 160 },
  askCardChip: { x: 1346, y: 136, w: 98, h: 32 },
  sessionTitle: { x: 1290, y: 76, w: 229, h: 36 },
  /** 镜头 5：结论速览第一条「性能健康度 75 / 100」 */
  reportPhs: { x: 1323, y: 398, w: 322, h: 34 },
  /** 镜头 5：结论第三条末尾那枚反向定位锚点 ⌖ 图上看 Free 轨 */
  anchorBtn: { x: 1400, y: 720, w: 92, h: 32 },
  /** 中间诊断视图 */
  chart: { x: 300, y: 20, w: 960, h: 1080 },
  /** 点完锚点后自动展开的 Overlap Analysis 三行 */
  overlapGroup: { x: 330, y: 556, w: 900, h: 130 },
  /** Free 轨那一行 */
  freeRow: { x: 330, y: 634, w: 900, h: 32 },
  /** 镜头 6：右键菜单，以及第一组里的「智能分析」 */
  ctxMenu: { x: 700, y: 526, w: 274, h: 320 },
  ctxMenuAnalyze: { x: 730, y: 576, w: 90, h: 28 },
  /** 镜头 6：拖影落进输入框后出现的那段算子文本 */
  droppedText: { x: 1300, y: 970, w: 580, h: 80 },
  /** 镜头 6：排队卡片头部「N 条排队消息」 */
  queueHead: { x: 1337, y: 837, w: 154, h: 32 },

  /**
   * ——— 镜头 7（G段）———
   * 全部量自 G段 2.6s 的静止帧。**画幅坐标就等于页面的 CSS px**：
   * 源 2880 宽 ÷ 1.5（Chrome 100% + 1.5x 屏）= 1920 CSS px = 画幅宽，y 再减 60。
   * 所以下面这些数可以直接和 chat.html 里的尺寸对照。
   */
  /** 面板左上角品牌行（点它弹出 Agent 列表） */
  brandRow: { x: 1288, y: 24, w: 152, h: 34 },
  /** Agent 弹层外框 */
  agentPopup: { x: 1280, y: 66, w: 312, h: 431 },
  /** 弹层里第一条的中心 y，以及往下每条的间距 —— 6 条：146 / 197 / 247 / 298 / 348 / 399 */
  agentRow0: 146,
  agentRowPitch: 50.6,
  /** 一条 Agent 的行胶囊、图标中心 x、文字左边界 */
  agentPill: { x: 1292, w: 288, h: 42 },
  agentIconX: 1317,
  agentTextX: 1346,
  /** 打勾 */
  agentCheckX: 1557,
  /** 弹层底部两个按钮（添加 Agent / 刷新） */
  agentBtns: { y: 437, h: 48, ax: 1292, bx: 1441, w: 139 },
  /** 欢迎页 Agent 头像（58px，和落版、镜头 2 的 logo 同一枚） */
  welcomeLogo: { x: 1558, y: 233, w: 58, h: 58 },
  /** 底部模型按钮的文字 */
  modelBtn: { x: 1424, y: 1054, w: 152, h: 34 },
  /** 「切换模型」弹层，以及被选中的 DeepSeek-V3.1 那一行 */
  modelPopup: { x: 1412, y: 750, w: 285, h: 300 },
  modelRow: { x: 1424, y: 854, w: 250, h: 40 },

  /**
   * ——— 镜头 8（H段-依次悬浮引导卡）———
   * 欢迎页三张牵引卡，量自 8 段 7.6s。卡片墙就从这三张的位置长出去。
   */
  welcomeTitle: { x: 1380, y: 326, w: 420, h: 36 },
  card1: { x: 1356, y: 392, w: 467, h: 114 },
  card2: { x: 1356, y: 522, w: 467, h: 114 },
  card3: { x: 1356, y: 651, w: 467, h: 109 },
  /** 右上角「新建对话」按钮 */
  newChat: { x: 1697, y: 24, w: 32, h: 32 },
} as const;

const clampTo = (v: number, lo: number, hi: number) =>
  lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);

/**
 * 画幅坐标 → CameraShot 的姿态。
 *
 * 推近时最容易犯的错是把画幅推出录屏之外（录屏只盖住 y ∈ [-60, 1140]），一露边就是一条白杠。
 * 这里按 safeScale 把焦点夹回合法区：焦点离画幅边至少 960/s、540/s。
 *
 * **bleedX：右侧允许「出画」多少画幅 px。**
 * 审片意见「输入框在画面右下角甚至溢出画面，希望靠中间一点」——
 * 对话面板贴着屏幕右缘，不放宽右边界就只能永远把它顶在画面最右侧。
 * 现在录屏自己带圆角 + 投影（见下面的 RecordingScreen），
 * 右侧露出来的那一条纯白底看起来正是「界面卡浮在白纸上」，不再是穿帮的白杠。
 *
 * **bleedY：下沿允许出画多少画幅 px。**
 * ⚠️ v2 审片「输入时输入框偏画面右下角，并有溢出界面的问题」的**真正根因在纵向**：
 * 上一版把 focusY 硬夹在 `SCREEN.bottom − 540/safeScale = 718`，
 * 于是 scale 1.34 下输入框底边正好落到画幅 y≈1084 —— 比 1080 多出 4px，被切掉一条。
 * 放开 20px 的下沿余量，焦点就能压到 736，输入框整个进画还留 58px 余量。
 *
 * 口诀：**任何姿态都要满足 `focusY ≤ 1140 − 540/scale`**（注意是本姿态的 scale，
 * 不是 safeScale）—— 等号成立时录屏底边正好压在画幅底边，多一点就露白。
 */
export const pose = (
  scale: number,
  x: number,
  y: number,
  safeScale = scale,
  bleedX = 0,
  bleedY = 0,
): CameraPose => {
  const halfW = 960 / safeScale;
  const halfH = 540 / safeScale;
  return {
    scale,
    focusX: (clampTo(x, halfW, 1920 - halfW + bleedX) / 1920) * 100,
    focusY:
      (clampTo(y, SCREEN.top + halfH, SCREEN.bottom - halfH + bleedY) / 1080) *
      100,
  };
};

/**
 * 一镜一只「镜头」：safeScale 传本镜用到的**最小** scale，之后所有姿态都按同一个合法区夹。
 *
 * 必须全镜统一，否则同一个坐标在两段里会被夹到不同位置 ——
 * 段与段交界处那一帧就会「跳」一下。段边界只要复用同一个姿态常量，就一定接得上。
 * bleedX / bleedY 同理，一镜一套值。
 */
export const lens =
  (safeScale: number, bleedX = 0, bleedY = 0) =>
  (scale: number, x: number, y: number): CameraPose =>
    pose(scale, x, y, safeScale, bleedX, bleedY);

/**
 * 录屏统一从这个目录取。
 *
 * `public/` 里的原始素材是 OBS 出的**长 GOP + B 帧** mp4（A段 32s 只有 8 个关键帧），
 * `<OffthreadVideo>` 在上面按任意帧 seek 会报 `No frame found at position ...`，
 * Studio 拖时间轴也卡。`tools/reencode-for-render.mjs` 把它们重编码成
 * 每 0.5s 一个关键帧、无 B 帧的版本落在这里 —— 分辨率、帧率、色彩都没动，
 * 所以下面那套 UI 坐标和各镜的时间码全部照旧。
 *
 * 换回原始素材只要把这个常量改成 ""。
 */
const RENDER_DIR = "render/";

/**
 * 录屏卡的圆角与投影。
 *
 * 审片意见「当录屏界面出现在页面中间看到边缘时，希望带一点圆角，而不是原生录屏的直角」——
 * 所以录屏不再是一块直接铺满的视频，而是**一张浮在白底上的界面卡**。
 * 圆角开得比常规大一档（26），因为它在推近的镜头里会被缩放放大；
 * 投影用两层，近的一层压住边缘、远的一层给「浮起来」的体积感。
 */
const CARD_RADIUS = 26;
const CARD_SHADOW =
  "0 30px 80px rgba(0,0,0,0.12), 0 4px 14px rgba(0,0,0,0.06)";

/**
 * 一段录屏。startSeconds 指「本段第 0 帧对应源里的第几秒」——
 * trimBefore 吃的是**合成帧**（不是源的 60fps 帧），所以统一在这里乘 fps，外面别自己算。
 */
export const RecordingScreen: React.FC<{
  src: string;
  startSeconds: number;
  /** >1 = 快放。源里「光标慢慢挪」的空档靠它压掉 */
  playbackRate?: number;
  /** 叠在录屏上的标注。坐标直接用上面的 UI 常量，会跟着镜头一起动 */
  children?: React.ReactNode;
}> = ({ src, startSeconds, playbackRate = 1, children }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: SCREEN.top,
          width: SCREEN.width,
          height: SCREEN.height,
          borderRadius: CARD_RADIUS,
          overflow: "hidden",
          boxShadow: CARD_SHADOW,
        }}
      >
        <OffthreadVideo
          src={staticFile(RENDER_DIR + src)}
          trimBefore={Math.max(0, Math.round(startSeconds * fps))}
          playbackRate={playbackRate}
          muted
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: SCREEN.width,
            height: SCREEN.height,
          }}
        />
      </div>
      {children}
    </AbsoluteFill>
  );
};

/**
 * 「一镜里要多段运镜」的写法（D4 踩过的坑 ②）收成一个组件：
 * Sequence 切段 → 每段自己套一层 CameraShot。
 *
 * from 是**原始帧**，调用方要把 useShotPad 加回去；
 * 本镜第一段传 from={0}、把 pad 算进 durationInFrames，才盖得住入场转场那半截。
 */
export const CameraSegment: React.FC<{
  from: number;
  durationInFrames: number;
  cam: { from: CameraPose; to: CameraPose };
  blur?: boolean;
  timing?: "ease" | "spring";
  children: React.ReactNode;
}> = ({ from, durationInFrames, cam, blur, timing, children }) => (
  <Sequence from={from} durationInFrames={durationInFrames} layout="none">
    <CameraShot from={cam.from} to={cam.to} blur={blur} timing={timing}>
      {children}
    </CameraShot>
  </Sequence>
);
