import { Easing, Img, interpolate, staticFile } from "remotion";
import { COLORS, FONT_FAMILY } from "../theme";

/**
 * 镜头 5 前半：思考过程竖轨（JSX 重绘）。
 *
 * 为什么不用 C段 录屏：源里这段跑了 18 秒，压进 4.5 秒是 4 倍速，字根本看不清。
 * 重绘之后节点节拍、秒表、「加粗数字随打随提亮」都能按帧写死 —— 这正是分镜细表要的效果，
 * 也是 PLAN.md D3 录制手册写的「思考轨会 JSX 重绘，C段 只作节奏和文案参考」。
 *
 * 版式、配色、圆点语义全部照抄 chat.html 的 .wzh-chat-think-*：
 * 圆点跑着是蓝 #0A59F7、跑完转绿 #09AA71；标题用一级文字色，正文压到 --foreground-muted。
 * 因为是特写，字号统一放大到 CSS 的 ~2.5 倍。
 *
 * ⚠️ 审片意见（局部 14）：**去掉置顶那行「诊断 xxx」**，另外补一层对话框背景 ——
 * 原来整幅画面只有一条孤零零的思考流，太空。现在思考流装进一张真正的对话面板里：
 * 面板顶栏 + 用户那条提问气泡（就是镜头 3 打出来的四行）+ 下面的思考竖轨。
 *
 * ⚠️ 节点耗时用的是**录屏里真实显示的那组数**（合计 9m24s），
 * 不是 PLAN.md 正文里举例的 12m08s —— 5.5s 处要硬切到 C段 录屏，
 * 那一帧上明晃晃写着「思考完成 9m24s」，两边对不上就穿帮。
 */

type Seg = { t: "p" | "b" | "c"; s: string };
type ThinkNode = {
  kind: "thinking" | "usetool";
  title: string;
  /** 本节点耗时（秒），右侧秒表走到这个数就停 */
  seconds: number;
  /** 逐行写死，不靠自动换行 —— 高度要能算出来，滚动才对得准 */
  lines: Seg[][];
};

const p = (s: string): Seg => ({ t: "p", s });
const b = (s: string): Seg => ({ t: "b", s });
const c = (s: string): Seg => ({ t: "c", s });

/** 7 个节点，文案取自 chat.html 的 PROFILING_THINK_SCRIPT，按镜头读得完的长度裁过 */
export const THINK_NODES: ThinkNode[] = [
  {
    kind: "thinking",
    title: "思考中",
    seconds: 47,
    lines: [
      [p("先别急着找瓶颈 —— 先确认这批数据能支撑什么结论。")],
      [p("格式决定路径："), b("DB 才能走 msprof-analyze 的集群 recipe"), p("。")],
    ],
  },
  {
    kind: "usetool",
    title: "校验数据完整性与采集配置",
    seconds: 90,
    lines: [
      [p("8 个 "), c("*_ascend_pt"), p("，PyTorch profiler、DB 格式，8 卡齐全。")],
      [b("TP1·PP4·DP2·CP1"), p("、Level1、"), c("profile_memory=false"), p("。")],
      [p("两条前提：内存维度采不到；"), b("PP=4 → bubble 是首要嫌疑"), p("。")],
    ],
  },
  {
    kind: "thinking",
    title: "思考中",
    seconds: 31,
    lines: [
      [p("单步 10.8 秒偏慢，先立三个互斥假设，再一个个证伪：")],
      [b("硬件型慢卡 / 慢链路 / 结构性负载不均"), p("。")],
    ],
  },
  {
    kind: "usetool",
    title: "msprof-analyze 集群分析 + advisor",
    seconds: 93,
    lines: [
      [p("八个 recipe 逐项跑，每个 mode 单独 "), c("-o"), p(" 到子目录；")],
      [p("同时后台并行跑 "), c("advisor all"), p("，"), c("cluster_analysis.db"), p(" 已落盘。")],
    ],
  },
  {
    kind: "usetool",
    title: "交叉验证集群表",
    seconds: 106,
    lines: [
      [p("8 卡 stepTime 极差 4 ms、"), b("CV≈0.012%"), p(" —— 没有掉队 rank。")],
      [p("但 rank6/7 计算是其余 6 卡的 "), b("1.51×"), p("。")],
      [p("跨节点 RDMA 实测 "), b("24.2 GB/s ≈ 理论值的 97%"), p("，链路健康。")],
    ],
  },
  {
    kind: "thinking",
    title: "思考中",
    seconds: 81,
    lines: [
      [p("慢卡、慢链路两个假设双双证伪，只剩结构性不均。")],
      [c("compute_op_sum"), p("："), c("MatMulV2"), p(" "), b("只在 rank6/7 出现"), p("，")],
      [p("16.0 ms × 64 次 ≈ 1024 ms，正是 lm_head / logits 投影。")],
    ],
  },
  {
    kind: "usetool",
    title: "实算 cube 利用率 / MFU / PHS",
    seconds: 116,
    lines: [
      [p("按耗时加权：cube 利用率 "), b("86%–98%（集群 ~92%）"), p("。")],
      [p("端到端 step MFU ≈ "), b("40% 出头"), p("。")],
      [p("PHS 归一化 → "), b("75（A 档下沿）"), p("。可以成文了。")],
    ],
  },
];

/** 7 个节点合计 564s = 9m24s，和录屏折叠条上的数字一致 */
export const THINK_TOTAL_SECONDS = THINK_NODES.reduce((s, n) => s + n.seconds, 0);

const HEAD_H = 52;
const LINE_H = 52;
const NODE_GAP = 34;
const nodeHeight = (n: ThinkNode) => HEAD_H + n.lines.length * LINE_H;

/** 每个节点的顶边 y（相对竖轨顶部）。高度写死才好算滚动 */
const NODE_TOP = THINK_NODES.reduce<number[]>((acc, _n, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + nodeHeight(THINK_NODES[i - 1]) + NODE_GAP);
  return acc;
}, []);
const TRACK_H =
  NODE_TOP[NODE_TOP.length - 1] + nodeHeight(THINK_NODES[THINK_NODES.length - 1]);

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeInOutQuad = Easing.inOut(Easing.quad);

const COLOR = {
  dotDone: "#09AA71",
  dotRunning: "#0A59F7",
  rail: "rgba(0,0,0,0.12)",
  body: COLORS.fgSecondary,
  strong: COLORS.fg,
  codeBg: "rgba(0,0,0,0.07)",
  codeFg: "#555555",
} as const;

const MONO = '"JetBrains Mono","Fira Code",Consolas,monospace';

/**
 * 对话面板的几何。整块思考流装在这张卡里，画面才不是「一条孤零零的流」。
 * 卡片居中偏左一点，右缘留白 —— 和录屏里面板贴右缘的构图区分开，观众知道这是特写重绘。
 */
const PANEL = { x: 268, y: 58, w: 1384, h: 964 };
const PANEL_PAD = 46;

/**
 * 用户那条提问：**原样抄 chat.html 的 `PROFILING_QUESTION`**（v2 局部 11）。
 * 上一版是我自己改写的四行，和镜头 3 录屏里真打出来的那四行对不上 —— 一对照就穿帮。
 * `#{profile_dir}` 在页面里会渲染成一枚 `.wzh-chat-qref` 蓝色引用标签，这里照做。
 */
const ASK_LINES: (string | { ref: string })[][] = [
  ["帮我诊断 ", { ref: "profile_dir" }, "：单步约 10.8 秒，比预期慢近三成。"],
  ["看看是慢卡、慢链路，还是并行切分不均，并给出数据依据。"],
  ["算一下 cube 利用率、MFU 和性能健康度。"],
  ["最后按收益排一份带优先级的优化清单。"],
];

/**
 * 面板顶栏 + 提问卡片。不随思考流滚动，是这张卡的固定部分。
 *
 * ⚠️ v2 局部 11：提问卡片的版式照抄 `.wzh-chat-qcard` ——
 * `align-self: stretch` 是**满宽**的，左右间距和对话栏一样，
 * 不是上一版那种靠右的气泡；圆角 12、内边距 12/14、底色是品牌蓝 9% 压在白底上，
 * 顶部先有一行带文件夹图标的锚点 chip。这里按特写放大 ~2.3 倍。
 * 左上角的 logo 也换成真的 `public/logo.png`，不再是一块蓝色占位方。
 */
const PanelHead: React.FC = () => (
  <>
    {/* 顶栏：只有品牌行，**没有**「诊断 xxx」那行字（v1 局部 14） */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        paddingBottom: 22,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ width: 34, height: 34, objectFit: "contain" }}
      />
      <span style={{ fontSize: 24, fontWeight: 600, color: COLORS.fgSecondary }}>
        MS Insight 智能助手
      </span>
    </div>

    {/* 提问卡片：满宽、左右间距一致（v2 局部 11） */}
    <div
      style={{
        margin: "26px 0 30px",
        background: "rgba(67,105,239,0.09)",
        borderRadius: 28,
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* 锚点 chip：和输入框上方那枚同款 */}
      <div
        style={{
          alignSelf: "flex-start",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "5px 16px",
          borderRadius: 12,
          background: "rgba(67,105,239,0.12)",
          fontSize: 24,
          color: COLORS.fg,
        }}
      >
        <Img
          src={staticFile("agents/folder.svg")}
          style={{ width: 22, height: 22 }}
        />
        <span>profile_dir</span>
      </div>

      {ASK_LINES.map((line, i) => (
        <div
          key={i}
          style={{
            fontSize: 31,
            lineHeight: 1.45,
            color: COLORS.fg,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
          }}
        >
          {line.map((seg, j) =>
            typeof seg === "string" ? (
              <span key={j}>{seg}</span>
            ) : (
              // .wzh-chat-qref：# + 名字，蓝底蓝字的引用标签
              <span
                key={j}
                style={{
                  display: "inline-block",
                  padding: "2px 11px",
                  borderRadius: 11,
                  background: "rgba(67,105,239,0.12)",
                  color: COLORS.blue,
                  fontSize: 27,
                }}
              >
                # {seg.ref}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  </>
);

const segLen = (line: Seg[]) => line.reduce((t, s) => t + s.s.length, 0);

/** 一行字。revealed = 本节点已打出多少字；revealFrameOf 把「第几个字」换算回帧，用来提亮 */
const Line: React.FC<{
  segs: Seg[];
  from: number;
  revealed: number;
  frame: number;
  revealFrameOf: (chars: number) => number;
}> = ({ segs, from, revealed, frame, revealFrameOf }) => {
  let cursor = from;
  return (
    <div
      style={{ height: LINE_H, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}
    >
      {segs.map((seg, i) => {
        const start = cursor;
        cursor += seg.s.length;
        const shown = Math.max(0, Math.min(seg.s.length, revealed - start));
        if (shown <= 0) {
          return null;
        }
        const text = seg.s.slice(0, shown);
        if (seg.t === "c") {
          return (
            <span
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: 27,
                color: COLOR.codeFg,
                background: COLOR.codeBg,
                padding: "2px 8px",
                borderRadius: 5,
                margin: "0 2px",
              }}
            >
              {text}
            </span>
          );
        }
        // 加粗段刚打完就提一下亮：分镜细表要的「加粗的数字随打随提亮」
        const doneAt = revealFrameOf(cursor);
        const lit =
          seg.t === "b"
            ? interpolate(frame, [doneAt, doneAt + 16], [1, 0], clamp)
            : 0;
        return (
          <span
            key={i}
            style={{
              fontSize: 30,
              fontWeight: seg.t === "b" ? 600 : 400,
              color: seg.t === "b" ? (lit > 0.02 ? COLORS.blue : COLOR.strong) : COLOR.body,
              textShadow:
                lit > 0.02 ? `0 0 ${20 * lit}px rgba(67,105,239,${0.55 * lit})` : undefined,
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
};

export const ThinkTrack: React.FC<{
  /** 本镜帧 */
  frame: number;
  /** 每个节点 [起帧, 止帧]，止帧一到圆点转绿 */
  beats: [number, number][];
  /** 整块向上合拢收起 */
  collapseStart: number;
  collapseEnd: number;
}> = ({ frame, beats, collapseStart, collapseEnd }) => {
  const collapse = interpolate(frame, [collapseStart, collapseEnd], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });

  const found = beats.findIndex(([, end]) => frame < end);
  const activeIdx = found === -1 ? THINK_NODES.length - 1 : found;
  const doneAll = frame >= beats[beats.length - 1][1];

  // 竖轨往上滚，让正在跑的那个节点始终停在同一条视线高度上
  const VIEW_ANCHOR = 300;
  const scrollTarget = (i: number) => Math.max(0, NODE_TOP[i] - VIEW_ANCHOR);
  const [bs, be] = beats[activeIdx];
  const within = easeInOutQuad(interpolate(frame, [bs, be], [0, 1], clamp));
  const scroll =
    scrollTarget(activeIdx) +
    (activeIdx < THINK_NODES.length - 1
      ? (scrollTarget(activeIdx + 1) - scrollTarget(activeIdx)) * within
      : 0);

  return (
    <div
      style={{
        position: "absolute",
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.w,
        height: PANEL.h,
        padding: PANEL_PAD,
        boxSizing: "border-box",
        fontFamily: FONT_FAMILY,
        // 对话面板本身：白卡 + 圆角 + 描边 + 长投影，和全片其它卡片同一套质感
        background: COLORS.surface1,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 26,
        boxShadow: "0 26px 70px rgba(0,0,0,0.10), 0 3px 10px rgba(0,0,0,0.04)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 顶栏 + 用户提问气泡。**没有**「诊断 xxx」那行字（审片局部 14） */}
      <PanelHead />

      {/* 折叠条：思考结束才出现（chat.html 的规则），也是硬切到 C段 那一帧的视觉锚点 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 30,
          color: COLORS.fgSecondary,
          opacity: collapse,
          height: 34 * collapse,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <span>思考完成</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtClock(THINK_TOTAL_SECONDS)}
        </span>
        <span style={{ fontSize: 26 }}>›</span>
      </div>

      {/* 思考竖轨的视口：只有这一块跟着滚，面板顶栏和提问气泡钉在上面不动 */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <div
        style={{
          position: "relative",
          marginTop: 22,
          height: TRACK_H,
          opacity: 1 - collapse,
          transform: `translateY(${-scroll - collapse * 90}px) scaleY(${1 - collapse * 0.14})`,
          transformOrigin: "0 0",
        }}
      >
        {/* 贯穿所有节点的细竖轨 */}
        <div
          style={{
            position: "absolute",
            left: 9,
            top: 14,
            bottom: 14,
            width: 2,
            background: COLOR.rail,
          }}
        />

        {THINK_NODES.map((node, i) => {
          const [start, end] = beats[i];
          if (frame < start) {
            return null;
          }
          const running = frame < end && !doneAll;
          const total = node.lines.reduce((s, line) => s + segLen(line), 0);
          // 正文逐字打出，留 15% 的尾巴给「读完」
          const typeFrom = start + 2;
          const typeTo = end - (end - start) * 0.15;
          const revealed = Math.round(
            interpolate(frame, [typeFrom, typeTo], [0, total], clamp),
          );
          const revealFrameOf = (chars: number) =>
            typeFrom + ((typeTo - typeFrom) * chars) / total;
          const clock = running
            ? interpolate(frame, [start, end], [0, node.seconds], clamp)
            : node.seconds;
          const appear = interpolate(frame, [start, start + 7], [0, 1], clamp);

          let offset = 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 46,
                top: NODE_TOP[i],
                right: 0,
                opacity: appear,
                transform: `translateY(${(1 - appear) * 14}px)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -44,
                  top: 16,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: running ? COLOR.dotRunning : COLOR.dotDone,
                  // 呼吸是圆点自己在缩放，背后不叠光环（chat.html 的注释点过名）
                  transform: running
                    ? `scale(${1.03 + 0.13 * Math.sin((frame / 30) * Math.PI * 1.33)})`
                    : "scale(1)",
                }}
              />
              <div
                style={{ display: "flex", alignItems: "baseline", gap: 18, height: HEAD_H }}
              >
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 500,
                    color: COLORS.fg,
                    // 进行中的标题在 chat.html 里是一道流光；这里用明度呼吸代替，浅底上更干净
                    opacity: running
                      ? 0.72 + 0.28 * Math.abs(Math.sin((frame / 30) * Math.PI * 1.67))
                      : 1,
                  }}
                >
                  {running || node.kind === "usetool" ? node.title : "思考完成"}
                </span>
                <span
                  style={{
                    fontSize: 28,
                    color: COLORS.fgSecondary,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtClock(clock)}
                </span>
              </div>
              {node.lines.map((line, li) => {
                const from = offset;
                offset += segLen(line);
                return (
                  <Line
                    key={li}
                    segs={line}
                    from={from}
                    revealed={revealed}
                    frame={frame}
                    revealFrameOf={revealFrameOf}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};
