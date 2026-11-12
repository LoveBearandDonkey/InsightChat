/* Six constructed conversation histories for the public demo.
   These are presentation fixtures, not tool executions or saved customer conversations. */
(() => {
  'use strict';
  const card=(id,title,description)=>window.MS_AGENT_CHAT.evidence('reuse:'+id,title,description);
  const q=(text,context)=>({role:'user',text,context});
  const a=(html)=>({role:'assistant',html});
  window.MS_AGENT_HISTORIES = [
    {story:'S1',title:'32 卡怎么保持原训练目标？',date:'11月04日',summary:'分组修复后，还要核对容量',context:'train_npu.sh · model.yaml',firstView:'config-relations',status:'候选已保留 · 真机待验证',messages:[
      q('今晚只有 32 卡。我把 DP 从 8 改成 4、微批从 1 改成 2，新模板还关闭了优化器分片。全局 batch 128、16K 和数值策略不变，先帮我检查，不占卡。','scripts/train_npu.sh · configs/model.yaml'),
      a('<p>先有一处确定的分组冲突：<strong>DP 已是 4，EP 仍为 8</strong>，当前规则下专家组无法组成。全局 batch 不变，只说明一项约束成立，不能证明这份配置可运行。</p><p>这次要一起核对设备数、并行分组、每卡专家和微批；建议先将 EP 调整为合法值，再检查容量。</p>'+card('config-relations','展开配置与并行分组关系','Config & Relation Observer · 配置来源、DP / EP 与 Rank 平面')),
      q('那把 EP 改成 4，是不是就能跑了？','候选 A · DP=4 / EP=4'),
      a('<p><strong>分组合法后，容量仍有风险。</strong>故事中的静态估算显示首段约 68.61 GiB，超过示例卡的 64 GiB。EP 缩小使每卡专家增多，微批加倍增加激活，关闭分片又增加优化器状态。</p><p>这是理论估算，运行预留采用未校准系数，尚未验证真实临时区和峰值。不能把“规则通过”标成“运行通过”。</p>'+card('config-relations','查看逐 Stage 理论容量','配置关系平面视图 · 并行分组、显存观测与 Stage 峰值估算')),
      q('保留训练目标，给我两个可比较的改法。','固定 GBS=128 · 序列长度=16K'),
      a('<p><strong>A：</strong>恢复优化器分片，微批降回 1，并增加梯度累积；<strong>B：</strong>恢复分片，保留微批 2，增加全量重计算。两者均修正 EP=4：A 为 MBS=1、累积=32，理论 46.79 GiB；B 为 MBS=2、累积=16，理论 33.14 GiB。均保持 GBS=128，并重新校验分组和容量。</p><p>A 增加累积次数；B 用额外计算换激活容量。没有匹配的测量包，暂不承诺哪一个更快。</p>'),
      q('先保留 A，给我能复核的方案，真机窗口后面再安排。','候选 A · 等效 batch 待复核'),
      a('<p>已在这段示例对话中保留 A：配置来源、交叉约束、理论容量和候选取舍一起交付。下一次验证核对真实峰值、特性生效、通信初始化及 checkpoint 保存/恢复。</p><p><strong>当前结论：候选可供审阅，运行仍待验证。</strong>截图保留原 demo 的模型和指标，展示关系视图的复用方式。</p>')
    ]},
    {story:'S2',title:'loss 分叉，先确认有没有比错',date:'11月05日',summary:'纠正输入与融合映射，再查首差',context:'GPU reference ↔ NPU candidate',firstView:'precision',status:'短程覆盖通过 · 长程待验证',messages:[
      q('GPU 和 NPU 的 loss 分叉了。按这份验收定义查一下，先不要改代码。','gpu-reference-01 ↔ npu-candidate-01'),
      a('<p>先暂停定位：两端样本位置不同，这一对结果<strong>尚不可比</strong>。请沿用同一权重、输入、mask、随机状态和训练阶段，再比较数值；设备不同是允许差异，输入错位不是。</p>'+card('precision','展开双端可比性与精度任务','已有精度调试工作台 · 整网、算子与双端对应')),
      q('输入已经固定，差异仍复现。按约定的小规模窗口继续，明早给我进展。','固定输入切面 · 有限取证预算'),
      a('<p>示例夜间记录已将范围缩到归一化相关区域：这里是<strong>当前覆盖内首个已观测异常</strong>，还不是根因。轮次中保留最近通过边界、未知分支和采集失败，不因某个中点通过就排除整个前半段。</p>'+card('trainscope','查看 loss 与模块的关联线索','已有 TrainScope · 盘古训练异常排障链示例')),
      q('这处融合输出应该对应 NPU 的两个张量，旧映射不对。用修订后的对应关系重算。','mapping revision 2 · 融合多对多对应'),
      a('<p>保留旧轮次，后续比较采用修订映射。先核对两端张量坐标、输入切面与误差口径，再做同输入局部重放。<strong>映射纠正会改变判断，旧结论不能继续沿用。</strong></p>'+card('precision','核对双端张量与首差位置','原 demo 截图预览 · 后续接入轮次和映射版本')),
      q('如果局部替换支持精度转换位置的假设，再给 Diff，并跑约定的短程回归。','隔离修改 · 局部与整网分别验证'),
      a('<p>故事中的干预支持精度转换位置假设，修复后局部误差和约定短程轨迹通过。交付最小复现、映射修订、轮次、Diff 与覆盖集；长程收敛继续待验。</p><p><strong>“已对齐”只覆盖已执行的输入与阶段。</strong>本页为构造对话；预览中的示例数值和根因不作为本任务实测。</p>')
    ]},
    {story:'S3',title:'显存降了，为什么仍不能交付？',date:'11月06日',summary:'offload 显存通过，联合验收失败',context:'失败现场 · 长序列反向 OOM',firstView:'memory-reuse',status:'局部重计算方案 · 保留失败实验',messages:[
      q('长序列训练在反向 OOM 了。batch、序列长度和数值策略不变，先看保全现场，别重跑。','npu-oom-01 · 失败现场与分配历史'),
      a('<p>先拆清口径：设备总占用、框架 allocated/reserved、可追踪分配和主机内存分别核对。未归属占用列为差额，不能全算成激活，也不能只看 reserved 就断言碎片。</p><p>已有现场能检查失败分配和活跃对象；缺失的失败前历史保留为未知。</p>'),
      q('失败时哪些对象还活着？我想看它们是不是同时叠在峰值上。','失败时刻 · Rank / 反向阶段'),
      a('<p>需要核对<strong>生命周期重叠</strong>，再决定是否能提前释放或重计算。故事中，一组前向激活在反向峰值仍需保留。</p>'+card('memory-reuse','展开生命周期与地址复用','已有内存复用分析 · 片上 buffer 的解释模式')+card('memory-workbench','查看生命周期 × 流水与峰值','已有内存工作台 · 后续适配整网 HBM 分配历史')),
      q('先试 offload。显存降下来就算通过了吗？','offload 候选 · 多指标验收'),
      a('<p><strong>显存目标通过，联合验收失败。</strong>这轮故事里，容量压力转移到了主机内存，搬运增加，业务步时超出门槛。不能把一次显存下降当作方案可交付。</p><p>保留这次失败结果并回退，再比较局部重计算。</p>'+card('monitoring','展开容量、时间与运行指标','已有训练监控 · 多指标联合检阅示例')),
      q('只对定位到的模块做局部重计算，再按原失败负载复验。','局部重计算 · 原失败负载回放'),
      a('<p>故事中采用更小的变更，并联合核对容量余量、业务步时、主机内存和精度；覆盖长短序列、相关 Rank 与 checkpoint 条件后，才接受本覆盖集。</p><p>右侧生命周期截图来自<strong>算子片上内存</strong>原型，展示解释模式；它不是这次整网 OOM 的 HBM 证据。后续需要接 msMemScope 的真实现场。</p>')
    ]},
    {story:'S4',title:'通信等待，真的是链路慢吗？',date:'11月07日',summary:'补采受阻后改计划，并修订目标范围',context:'Insight · 常规训练步时优化',firstView:'performance',status:'前置计算已优化 · 保存开销单列',messages:[
      q('精度和容量检查已通过，但常规训练步时仍不达标。先定位差距，保持工作负载和验收门槛。','Insight 基线 · 常规训练区间'),
      a('<p>首轮发现通信等待，但缺 Host/调用上下文，<strong>暂不能归因为链路慢</strong>。当前作业补采前置检查未通过，本次补采未执行；保留现有报告，改用已预留测试窗口采最小相关区间。</p>'+card('performance','展开首轮性能发现与证据','已有智能性能分析 · 报告、模型图和 Timeline')),
      q('这段等待是周期性 checkpoint 保存，本轮常规步时不含它。保存开销请另列。','目标修订 2 · 排除保存窗口'),
      a('<p>按修订口径重算候选，旧报告保留。保存窗口排除后，不能据此宣称整体更快；它的耗时和恢复正确性仍需独立验收。</p><p>约定补采作业可以在面板关闭后继续，返回时从检查点接续。</p>'),
      q('补采回来了。帮我确认，是卡在等通信，还是在等迟到的 Rank？','新采集 · 同一 collective 实例'),
      a('<p>故事中的到达关系支持：<strong>部分卡在等迟到 Rank 的前置计算</strong>。“慢链路”假设暂未获支持。先核对同一通信实例、时钟与相关 Rank，再查迟到卡的调用次数、shape 和代码。</p>'+card('communication','展开 Rank、流量与等待关系','已有分布式通信观测台 · 拓扑与路由示例')),
      q('确认是适配层重复处理。给最小 Diff，审过后做同负载复验，别动通信参数。','版本化 Diff · 精度与业务步时复验'),
      a('<p>故事中移除不必要的数据处理后，约定精度与常规步时复验通过；保存开销保持独立状态。交付范围修订、补采失败、新证据、Diff 和前后结果，供迁移验收复核。</p>'+card('swimlane','查看前后执行泳道的比较方式','已有 Swimlane · Before / After 与任务下钻')+'<p>此处回放构造的历史对话。原任务仍由 Insight 主控，msAgent 展示同一故事的检阅入口。</p>')
    ]},
    {story:'S5',title:'迁移交付包还缺哪项验收？',date:'11月09日',summary:'吞吐口径不同，恢复未测，暂缓交付',context:'GPU → NPU · 当前版本交付包',firstView:'migration',status:'验收缺项已明确 · 逐项复核',messages:[
      q('团队说已经能跑、速度也不错。按这个交付包的验收标准，当前 NPU 版可以接收吗？','GPU reference + NPU candidate · S1–S4 产物'),
      a('<p><strong>当前先暂缓交付。</strong>有两项阻塞：吞吐统计范围不可比；checkpoint 恢复未测。“已能运行”不能覆盖这两项。</p><p>先核对迁移阶段和支持范围，再逐项回到当前版本的证据。</p>'+card('migration','展开迁移阶段与交付链路','已有 AscendPort · 算子迁移七阶段示例')+card('operator-matrix','核对模型、阶段与硬件支持','已有算子矩阵 · 兼容性检查模式')),
      q('两边不是都给了吞吐吗，为什么不能比？','性能验收项 · 统计口径'),
      a('<p>GPU 记录包含数据准备，NPU 只统计稳定训练段。分母范围不同，两个吞吐数不能直接形成迁移收益。</p><p>统一负载、预热、Step 区间与端到端口径后重算；设备和软件栈差异允许存在，但要解释清楚。</p>'+card('monitoring','查看运行指标与对比入口','已有训练监控 · 原始运行与效果比较示例')),
      q('按同一口径补齐比较，再安排保存/恢复测试。补验结果直接关联这版交付清单。','本版交付清单 · checkpoint 恢复'),
      a('<p>在故事中，补验分别回到性能和恢复验收项：配置、精度、容量、业务性能、稳定性及 checkpoint 都需要可追溯结果。失败项保持阻塞，缺项保持待验，不能以“报告已生成”代替通过。</p>'),
      q('证据齐全后再接收，并把未覆盖的设备与负载列入边界。','当前版本 · 验收边界'),
      a('<p>按约定覆盖集完成后才接收当前版本；清单保留每项结论、标准、运行版本和原始产物。新设备、新输入分布及长程稳定性另行验收。</p><p>预览中的 AscendPort 是<strong>算子迁移</strong>流程，算子支持矩阵是兼容性参考；整网交付和恢复验收还需后续集成。</p>')
    ]},
    {story:'S6',title:'资源未到，先测哪两套方案？',date:'11月10日',summary:'补齐时延约束，用校准修正候选排序',context:'推理部署 · 模型产物与请求分布',firstView:'candidates',status:'候选与实测计划 · 服务仿真待集成',messages:[
      q('设备还没到齐。按这份模型和请求分布，预算内先选两套值得实测的部署方案。','模型交付包 · 请求长度/到达分布'),
      a('<p>已有模型、资源预算和请求分布，还缺<strong>TTFT、TPOT 与尾延迟目标</strong>。缺这些约束，只能给吞吐排序，不能判断服务可用。</p><p>请补齐目标，同时锁定引擎、精度/量化版本和设备拓扑；已有输入不重复填写。</p>'),
      q('时延目标已补齐。我要并排看候选、淘汰原因和资源余量。','业务约束完整 · 保持预算不变'),
      a('<p>候选应同时列吞吐、时延、容量、资源和假设；高吞吐项若缺尾延迟证据，仍是待验证。保留淘汰原因，避免只显示一个黑箱推荐。</p>'+card('candidates','展开候选取舍与淘汰路径','复用 Recommendation Trace 的解释模式 · 原图为算子候选')+'<p>这张已有 demo 尚未覆盖服务部署，先用于确认候选比较的阅读方式。</p>'),
      q('新设备画像还没校准，第一笔测试预算应该花在哪？','未校准设备画像 · 有限测试窗口'),
      a('<p>先选受支持的代表配置，测最影响判断的负载区间。把理论画像、校准预测和实测点分开，测试排队、失败与缺测也独立记录。</p>'+card('hardware','展开设备层级与数据路径','已有 Ascend A5 架构映射 · 硬件画像解释，尚非性能校准')),
      q('短测发现长输入 prefill 的代价被低估了。更新排序，保留两个最值得继续测的方案。','校准修订 · 长输入 prefill 偏差'),
      a('<p>在故事中，偏差改变候选排序；保留两套方案及下一轮代表负载压测计划，同时交付假设、画像来源和未建模因素。</p><p><strong>当前交付是实验决策依据。</strong>完整 TTFT/TPOT、尾延迟、容量与成本仍需真实服务测试。现有算子推荐和硬件图仅复用交互模式；msModeling 的服务仿真与校准视图后续接入。</p>')
    ]}
  ];
  // Architecture proposal: one mindstudio server; task/training are internal groups.
  // Curated action summaries for the fixture, never actual model reasoning or live calls.
  const s1Thoughts = [
  [
    [
      "读取配置来源",
      "resolve_training_config",
      "读取启动脚本、64 卡基线、新草稿与资源声明；锁定 GBS=128、16K 和数值策略。",
      "MindSpeed"
    ],
    [
      "核对并行约束",
      "check_training_config",
      "world=4×4×2×1=32；split 口径要求 DP % EP=0，DP=4 / EP=8 阻断。",
      "MindSpeed"
    ],
    [
      "保留检查边界",
      "get_training_trial_result",
      "非法草稿先不输出容量结论；实际通信组与运行特性仍待验证。",
      "MindSpeed"
    ]
  ],
  [
    [
      "复核 EP=4 候选",
      "check_training_config",
      "只在候选副本修正 EP，复查分组；不改源配置，不提交训练。",
      "MindSpeed"
    ],
    [
      "筛选理论容量",
      "plan_training_trial",
      "按逐 Stage 容量检查合法候选；首段理论 68.61 GiB / 64 GiB。",
      "MindSpeed · 配置能力适配草案"
    ],
    [
      "解释容量分项",
      "get_training_trial_result",
      "关联每卡专家、微批激活与优化器分片变化；理论风险与实测 OOM 分列。",
      "MindSpeed"
    ]
  ],
  [
    [
      "构造两个候选",
      "plan_training_trial",
      "保持训练目标：A 减微批、增累积；B 保留微批、全量重计算；共同恢复 ZeRO-1。",
      "MindSpeed / MindStudio Training Tools"
    ],
    [
      "复查等效关系",
      "check_training_config",
      "A：1×4×32=128；B：2×4×16=128；逐项复查 EP、分片与重计算。",
      "MindSpeed"
    ],
    [
      "核对仿真前提",
      "plan_training_trial",
      "检查 Tinker 的支持组合与 profiled_data_path；缺匹配测量包，跳过 submit_training_trial。",
      "MindStudio Training Tools / Tinker"
    ],
    [
      "汇总候选取舍",
      "get_training_trial_result",
      "只呈现理论容量 46.79 / 33.14 GiB；无模拟步时，不据容量高低判断速度。",
      "MindSpeed / MindStudio Training Tools"
    ]
  ],
  [
    [
      "复核所选方案 A",
      "check_training_config",
      "保留 EP=4、ZeRO-1、MBS=1、累积=32；训练目标与恢复进度不变。",
      "MindSpeed"
    ],
    [
      "关联交付产物",
      "attach_artifact",
      "关联候选配置、Diff、规则来源、容量依据与未验证项；不触发运行。",
      "MindStudio Agent · 任务与产物"
    ],
    [
      "读取检阅包",
      "get_artifact",
      "返回同一版本的方案引用；真机峰值、通信初始化、特性及 checkpoint 恢复列为待验。",
      "MindStudio Agent · 任务与产物"
    ]
  ]
];
  window.MS_AGENT_HISTORIES[0].messages.filter(m=>m.role==='assistant').forEach((m,i)=>{
    m.thinking=s1Thoughts[i].map(([title,tool,text,product])=>({title,server:'mindstudio',group:['attach_artifact','get_artifact'].includes(tool)?'task':'training',tool,text,product}));
  });
})();
