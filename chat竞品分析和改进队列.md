# Chat 竞品分析和改进队列

更新时间：2026-09-03

## 一、结论摘要

NVIDIA 的正式产品名称是 **Nsight Systems** 和 **Nsight Compute**，不是“Nsight Computer”。智能能力的品牌正在从 **Nsight Copilot** 升级为 **Nsight AI**，但当前 Nsight Compute 的产品界面、集成模块和文档仍大量使用 “Nsight Copilot”。更准确的理解是：

> **Nsight AI 是新的总品牌；Nsight Copilot 仍是其中的助手、VS Code 扩展和自托管 Blueprint 名称。**

目前可以确认的深度性能数据对话主要集成在 **Nsight Compute**。没有发现 NVIDIA 官方资料证明 Nsight Systems 已经内置同等级的 Copilot 对话面板。

两款 profiler 与 AI 的关系可以概括为：

- **Nsight Systems**：从系统、进程、CPU、GPU、网络和多节点时间线中发现“哪里慢”。
- **Nsight Compute**：深入单个 CUDA Kernel，解释“为什么慢”。
- **Nsight AI / Copilot**：把 Compute 的 profile result、section 和 rule 转换为可继续追问的自然语言解释与优化指导。

我们的 `chat.html` 更适合定位为：

> **面向 Ascend 大模型分布式训练的性能调查 Agent：从多 Rank Profiling 数据出发，归因并行策略、通信、调度和算子问题，最终输出可执行的整改方案。**

不宜与 Nsight 正面对标“谁的 profiler 指标更多”。更有价值的竞争策略是：

> **Nsight/传统 profiler 负责产生事实，我们负责把分散的多 Rank、通信、训练和算子事实组织成可执行的训练优化决策。**

---

## 二、NVIDIA 产品定位

### 2.1 Nsight Systems：系统级、时间线和多节点分析

Nsight Systems 解决的是宏观、跨组件问题：

- 将 CPU 线程、CUDA API、GPU Kernel、内存传输、cuBLAS、cuDNN、TensorRT、网络通信和操作系统事件放在统一时间线上。
- 支持 PCIe、NVLink、DRAM、SM、Tensor Core、指令吞吐和 warp occupancy 等采样。
- 支持 Python 调用栈采样、JupyterLab、远程分析和多节点集群分析。
- 适合定位 GPU 空洞、CPU 下发不足、同步等待、通信未重叠、NUMA 和网络问题。
- 多节点分析能够跨节点识别性能限制，并结合网络指标和 Python backtrace 观察 GPU、CPU、DPU 与节点间通信。
- 支持插件把外部数据和 NVTX 事件带入同一时间线。

它的核心价值是提供统一、相对客观的系统事实层，而不是只观察某一个 Kernel。

官方产品页：

```text
https://developer.nvidia.com/nsight-systems
```

官方用户指南：

```text
https://docs.nvidia.com/nsight-systems/UserGuide/
```

### 2.2 Nsight Compute：Kernel、硬件指标和源码级分析

Nsight Compute 面向单个 CUDA/OptiX Kernel 的深度分析：

- 采集硬件级性能计数器。
- Guided Analysis 规则自动识别常见瓶颈并给出建议。
- 支持 GPU 吞吐、warp stall、occupancy、Roofline、内存层级和访问路径分析。
- 将 CUDA C/C++、PTX、SASS 与指标关联到具体源代码行。
- 可设置 baseline，在工具中直接比较优化前后结果。
- 支持 GUI、CLI、本机和远程采集。
- 支持 NVRules、Python Report Interface、自定义 metric collection 和分析规则。
- 新版本支持报告合并、聚类、CUDA Graph 可视化和寄存器依赖分析。

它的核心壁垒不只是指标数量，而是可以把问题从汇总页逐层落到具体源代码行和机器指令。

官方产品页：

```text
https://developer.nvidia.com/nsight-compute/
```

官方文档：

```text
https://docs.nvidia.com/nsight-compute/
```

---

## 三、Nsight AI / Copilot 的能力与易用性亮点

### 3.1 AI 入口紧贴性能问题

Nsight Compute 的 Details 页在 section 和 rule 旁提供 Copilot 按钮。用户点击后，工具会：

1. 打开对话面板；
2. 自动生成解释当前 section 或 rule 的问题；
3. 自动附加当前聚焦的 profile result；
4. 结合该次采集的指标和性能特征生成回答。

它减少了“复制指标—打开聊天工具—粘贴—重新描述背景”的操作成本。这是 Nsight Copilot 最重要的易用性亮点。

### 3.2 代表场景：非合并内存访问

官方展示的 Nsight Compute 集成案例聚焦 uncoalesced memory access：

- Nsight Compute 的规则识别到非合并内存访问；
- 用户从对应性能规则直接发起 Copilot 查询；
- 当前 profile result 自动进入上下文；
- Copilot 解释现象、原因和可能的修改方法；
- 用户可以围绕同一个结果继续追问。

这说明 NVIDIA 当前的实现重点是：

> 把已有 profiler 规则和可靠性能数据转化为自然语言解释及交互式指导，而不是让 LLM 完全替代 profiler 自主探索任意原始数据。

Nsight AI 官方页面：

```text
https://developer.nvidia.com/nsight-ai
```

### 3.3 搜索与聊天统一入口

Nsight Compute 的搜索栏同时支持：

- `/search <query>`：搜索文档、metric、option 等工具内容；
- `/chat <query>`：进入 Copilot 对话。

这降低了用户判断“我是在查字段定义，还是需要 AI 分析”的成本。

### 3.4 Agent 过程和参考依据可见

Nsight Copilot 支持：

- 流式回答；
- 停止生成；
- 可折叠的 agent processing steps；
- 回答下方的 References；
- Retry、Copy、Save、点赞和点踩；
- 多个独立会话；
- 会话重命名、切换和删除；
- 历史问题自动补全。

性能分析用户通常不会完全信任一个直接给出的结论。处理步骤和参考来源的可见性有助于建立信任。

### 3.5 上下文控制明确

用户可以附加一个 profile result，并通过“眼睛”按钮临时决定是否将其发送给模型。这样既能维持对话上下文，又能明确控制数据是否参与本次请求。

### 3.6 当前限制

官方文档明确列出了以下限制：

- profile report 必须先保存到磁盘，才能作为 Copilot 上下文。
- 要让 Copilot 获得源代码信息，采集时必须启用 `--import-source yes`。
- report 文件本身不上传，但抽取的 metrics 和 section summaries 会发送给语言模型。
- Copilot 依赖 LLM，可能给出不准确答案，用户仍需评估回答是否适用于当前问题。
- 当前公开的 Compute 集成示例主要集中在内存分析等具体问题，尚不足以证明它已覆盖所有跨节点训练诊断场景。

Copilot 集成、上下文及限制文档：

```text
https://docs.nvidia.com/cuda/developer-preview/13.4/nsight-compute/NsightCompute/index.html#nsight-copilot
```

Nsight Compute 2026.2 with Nsight Copilot Preview 下载页：

```text
https://developer.nvidia.com/tools-overview/nsight-compute/get-started
```

### 3.7 托管与私有化两条路线

Nsight AI 当前包含：

- NVIDIA 托管的 CUDA MCP Server，为 Codex、Claude 等 Agent 提供较新的 CUDA 官方知识。
- Nsight Copilot VS Code 扩展。
- Nsight Compute 内置 Copilot。
- 开源、自托管的 Nsight Copilot Blueprint。

自托管 Blueprint 支持：

- CUDA 专业对话；
- CUDA 代码生成与自动补全；
- 代码转换和优化；
- 基于 NVIDIA CUDA 文档与样例的 RAG；
- OpenAI-compatible streaming；
- 本地部署，降低代码和提示词外发风险。

代价是部署较重：Ubuntu、Docker Compose、NVIDIA Container Toolkit、约 200GB 磁盘空间，并需要能够承载模型的 Hopper 或更新架构 GPU。

Blueprint 项目：

```text
https://github.com/NVIDIA-AI-Blueprints/nsight-copilot
```

Blueprint README：

```text
https://github.com/NVIDIA-AI-Blueprints/nsight-copilot/blob/main/README.md
```

自托管部署说明：

```text
https://github.com/NVIDIA-AI-Blueprints/nsight-copilot/blob/main/docs/deploy-docker-self-hosted.md
```

---

## 四、NVIDIA 性能分析案例

### 4.1 512 GPU 训练通信瓶颈

在 GB300 NVL72、512 GPU 的 Nemotron-4 15B 训练中：

- 相对目标存在约 31% 性能差距；
- Nsight Systems 时间线发现 AllGather 和 ReduceScatter 大量暴露在关键路径上；
- 将 `NCCL_IB_QPS_PER_CONNECTION` 从 1 调至 4；
- 参考 workload 的单次迭代由约 1.09 秒降至约 0.83 秒；
- AllGather 约从 375ms 降到 262ms；
- ReduceScatter 约从 389ms 降到 273ms。

亮点是它没有只报告“网络利用率低”，而是通过通信区间和计算重叠关系把问题收敛到具体 NCCL 参数。同时，NVIDIA 特别强调该参数依赖 fabric、消息大小和 workload，不能机械套用。

案例来源：

```text
https://developer.nvidia.com/blog/nvidia-exemplar-cloud-lessons-for-unlocking-full-performance-on-ai-infrastructure/
```

### 4.2 PyTorch ResNet50 数据布局优化

在 A100 上：

- Nsight Systems/PyProf 显示 Kernel 顺序及框架调用栈；
- TF32 将 forward 时间从约 188.4ms 降至 110.25ms；
- AMP 后约为 72.86ms；
- 将 PyTorch 内存布局切换为 channels-last，消除了格式转换 Kernel；
- 总 Kernel 时间进一步降至约 45.6ms。

该案例体现了 Systems 的强项：从框架调用、数据布局和格式转换一直关联到 GPU Kernel。

案例来源：

```text
https://developer.nvidia.com/blog/profiling-and-optimizing-deep-neural-networks-with-dlprof-and-pyprof/
```

### 4.3 Nsight Compute 定位寄存器与访存问题

在一个内存访问优化案例中：

- Nsight Compute 通过 source/SASS 对照发现，性能并不只是 load 指令数量问题；
- 进一步定位到寄存器分配与 occupancy 的关系；
- 使用 launch bounds 调整寄存器资源；
- 最终获得约 1.79 倍加速。

该案例体现了 Compute 的不可替代性：从表面上的“内存慢”继续深入 sector request、寄存器资源和机器指令级原因。

案例来源：

```text
https://developer.nvidia.com/blog/boosting-application-performance-with-gpu-memory-access-tuning/
```

### 4.4 游戏卡顿定位

在 Wolfenstein: Youngblood 案例中：

- Nsight Systems 自动定位到约 30.8ms 的卡顿；
- 将根因关联到运行时创建光追 pipeline 的 API 调用；
- 解决方案是在初始化阶段预先创建 pipeline permutations，避免游戏过程中编译。

该案例体现了统一时间线、慢帧自动标记和 API 归因的易用性。

案例来源：

```text
https://developer.nvidia.com/blog/using-nsight-systems-for-fixing-stutters-in-games/
```

### 4.5 Guided Analysis 的问题排序和源码标记

Nsight Compute 能够：

- 在 Summary 页列出检测到的问题；
- 按预计修复收益辅助排序；
- 在 Source 页把规则命中落到对应代码行；
- 通过 baseline 快速对比修改前后的效果。

来源：

```text
https://developer.nvidia.com/blog/nvidia-cuda-toolkit-12-2-unleashes-powerful-features-for-boosting-applications/
```

---

## 五、当前 `chat.html` 的能力

本地文件：

```text
D:\Projects\my-video\chat.html
```

### 5.1 已体现的产品能力

#### 场景化入口

欢迎页直接提供内存优化、快慢卡诊断、领域知识 RAG 等入口，让用户不必先学会如何写性能分析提示词。

对应代码：

```text
chat.html:6625
```

#### Profiling 数据上下文引用

输入 `#` 可以选择：

- 整个八卡采集目录；
- 某个 Rank 的具体文件；
- 例如 `rank6/kernel_details.csv` 这样的明确证据对象。

文件名附带 Rank，可以避免多卡同名文件引用歧义。

对应代码：

```text
chat.html:6882
chat.html:9677
```

#### 图到对话的上下文传递

泳道中的算子可以右键选择：

- 置入智能对话；
- 智能分析。

系统会自动携带当前文件、泳道、算子名称和耗时。

对应代码：

```text
chat.html:7297
```

#### 对话到图的反向定位

AI 回答支持自定义 `[[lane:泳道ID::文字]]` 语法。渲染后，用户可以从回答证据跳回对应泳道并高亮。

对应代码：

```text
chat.html:8024
```

#### 长任务排队提问

回答进行中，用户可以继续发送问题。后续问题进入队列，支持展开、收起、单项删除和全部清除，当前回答结束后自动执行。

对应代码：

```text
chat.html:6671
chat.html:8791
```

#### 透明诊断过程

演示过程显式展示：

1. 确认数据形态和完整性；
2. 确定分析路径；
3. 建立慢卡、慢链路、结构性负载不均三个互斥假设；
4. 运行集群分析和 advisor；
5. 多表交叉验证；
6. 证伪错误假设；
7. 计算 cube 利用率、MFU 和 PHS；
8. 输出行动清单和验收标准。

对应代码：

```text
chat.html:9191
```

#### 决策型诊断报告

当前示例报告包含：

- 结论速览；
- 性能健康度；
- P0/P1/P2 优先级；
- 预期收益；
- 改动位置；
- 验证方式；
- 已确认没有问题的部分；
- 数据和计算口径。

对应代码：

```text
chat.html:9253
```

#### 多 Agent、模型与工作模式 UI

当前界面提供：

- MS Insight Native、Pangu、DeepSeek、GLM、Codex、Claude；
- 每个 Agent 下的模型选择；
- Build/Plan 模式切换；
- 会话标题；
- 新建对话；
- 流式回答和停止；
- 代码块复制。

对应代码：

```text
chat.html:6713
chat.html:10220
```

---

## 六、我们相对 Nsight 的优势和劣势

| 维度 | Nsight | 我们当前方向 | 判断 |
|---|---|---|---|
| 核心场景 | 通用 NVIDIA/CUDA 性能分析 | Ascend 大模型、多卡训练诊断 | 我们更垂直，Nsight 更通用 |
| 分析粒度 | 系统、API、Kernel、源码、PTX/SASS、硬件计数器 | Rank、PP/DP、HCCL、训练 step、算子汇总、MFU/PHS | 关注层级不同，可形成互补 |
| AI 与视图联动 | rule/section 一键提问，自动附加 profile result | 泳道到 AI、AI 回答到泳道、`#` 文件上下文 | 我们的双向设计更完整 |
| 诊断表达 | 解释 metric/rule 并提供优化指导 | 结论、排除项、证据链、收益、优先级、验证方法 | 我们更接近专家交付报告 |
| 多卡训练理解 | Systems 有多节点事实层，AI 深度集成主要在 Compute | 原生围绕 PP bubble、慢卡、通信重叠和 Rank 差异 | 我们有场景优势 |
| 精确性基础 | 官方硬件计数器、规则、架构知识、源码/SASS 关联 | 依赖导出的 DB/CSV 和上层推理 | Nsight 底层证据更强 |
| 知识可信度 | 官方 CUDA RAG、References、成熟规则系统 | 当前真实请求使用通用 DeepSeek，尚无完整引用 | Nsight 领先 |
| 开放性 | 锁定 NVIDIA/CUDA，但接口和插件体系成熟 | 可围绕 Ascend/MindStudio/msprof，也可扩展其他后端 | 我们有平台扩展机会 |
| 交互效率 | 流式、停止、多会话、保存、自动问题、上下文开关 | 排队提问、Build/Plan、Agent/模型、命令和文件引用 | 我们概念更多，落地度不足 |
| 产品成熟度 | 商用品质、跨平台、远程采集、版本比较和自动规则 | 当前为单页演示原型 | Nsight 大幅领先 |

### 6.1 我们的主要优势

#### 优势一：更懂大模型分布式训练语义

我们直接围绕以下概念进行分析：

- PP stage；
- DP group；
- HCCL 通信；
- P2P recv 等待；
- pipeline bubble；
- lm_head/loss 末级负载；
- 多 Rank 快慢差异；
- MFU 和训练健康度。

这些不是单 Kernel profiler 天然能够完整回答的问题。

#### 优势二：诊断过程形成完整证据链

当前示例已经表现出一种高级性能工程师的排查模式：

```text
建立互斥假设
→ 分别证伪慢卡和慢链路
→ 多表交叉验证
→ 找出具体多算的算子
→ 估算收益
→ 给出复采验收标准
```

这比“发现指标异常后罗列通用建议”更有业务价值。

#### 优势三：图与对话形成双向闭环

Nsight 的强项是“报告项到对话”。我们已经设计：

```text
算子/泳道
→ 携带上下文提问
→ AI 输出带证据的结论
→ 点击证据返回泳道并高亮
```

这是值得重点保留和强化的产品差异。

#### 优势四：面向最终决策

我们的报告不仅解释指标，还试图回答：

- 是不是硬件问题；
- 是否值得继续训练；
- 哪一项先改；
- 预计能快多少；
- 修改后怎样验收；
- 下一次 Profiling 应补采哪些数据。

这些问题通常比展示更多底层计数器更接近训练工程师的真实目标。

#### 优势五：排队提问适合长分析任务

真实性能分析可能需要运行多个 recipe。允许用户在当前任务执行期间继续安排追问，比单轮等待更适合 Agent 型产品。

### 6.2 当前主要劣势

#### 劣势一：核心性能诊断是硬编码演示

当前文件明确注明：Profiling 流程、思考过程和诊断报告全部写死，输入内容只是触发固定结果。

对应代码：

```text
chat.html:8988
chat.html:9384
```

这是当前与 Nsight 最大的差距。界面显示“扫描目录、运行 msprof-analyze、交叉验证”并不代表这些操作已经真实执行。

#### 劣势二：`#文件` 尚未形成真实数据读取闭环

原型能选择 `rank6/kernel_details.csv`，但真实 DeepSeek 请求主要发送用户文本和训练态 system prompt，没有看到对被引用文件的实际读取、解析、摘要和结构化注入。

这会造成明显的信任风险：用户以为模型已经读取文件，但模型实际可能只看到了文件名。

#### 劣势三：Agent、模型和 Build/Plan 当前只是 UI 状态

代码已经明确说明：Agent 和模型切换不会真正切换后端。

对应代码：

```text
chat.html:10220
```

如果正式产品继续提供这些入口，必须保证它们确实改变执行模型、工具集或工作方式。

#### 劣势四：缺少 Nsight 级别的底层数据能力

当前不能替代 Nsight Compute 的：

- 硬件计数器；
- Roofline；
- warp stall；
- cache/sector/request；
- source/PTX/SASS 对照；
- baseline 实验比较；
- Kernel replay；
- GPU 架构级规则。

因此更适合定位为“上层训练诊断和决策助手”，不宜宣称全面替代 Nsight Compute。

#### 劣势五：缺少可审计的引用体系

当前报告虽然包含大量数字，但没有把每个结论稳定绑定到：

- 输入文件；
- Rank；
- 数据表；
- 字段和记录；
- 时间区间；
- 工具命令及参数；
- 规则版本；
- 知识文档版本。

性能诊断中，“结论可追溯”通常比“回答写得像专家”更重要。

#### 劣势六：真实聊天链路存在工程与安全风险

当前页面把用户 API Key 保存在浏览器，并由前端直接请求 DeepSeek。

对应代码：

```text
chat.html:7563
chat.html:8137
```

正式产品需要解决：

- 凭据托管；
- 企业代理；
- 审计；
- 数据脱敏；
- 权限控制；
- 日志留存；
- 离线和私有化部署。

#### 劣势七：部分可见功能仍是占位

从当前代码看，历史对话、语音输入、添加 Agent 等按钮尚未体现完整业务实现。对外展示时应明确原型边界，避免可见但不可用的入口削弱整体完成度。

---

## 七、改进队列

### P0：必须先解决的真实性和可信度问题

#### P0-1：把演示脚本改造成真实 Agent 工具链

目标：让界面展示的每一步都对应真实执行。

需要实现：

- 扫描用户选中的 Profiling 目录；
- 检测 Rank、框架、文件格式和采集完整性；
- 实际调用 `msprof-analyze` 和 advisor；
- 保存命令、参数、stdout、stderr、退出码和产物路径；
- 解析 cluster analysis、算子、通信、频率和空闲数据；
- 由 Agent 根据数据动态建立和证伪假设；
- 根据本次真实结果生成报告，而不是选择预置答案。

验收标准：

- 换一套数据，诊断过程、数字、结论和建议会同步变化；
- 每个“使用工具”节点都有真实运行记录；
- 失败时展示真实错误和可恢复建议。

#### P0-2：让 `#上下文` 真正读取数据

目标：用户引用文件后，模型确实使用该文件内容。

需要实现：

- 支持 CSV、JSON、DB、trace、xlsx 等类型；
- 大文件进行结构化解析、采样、统计和按需检索，避免全文塞入模型；
- 在发送前显示“本次将包含哪些数据”；
- 明确区分“仅引用文件名”和“已读取文件内容”；
- 记录文件 hash、修改时间和解析器版本；
- 对超大目录建立索引，并允许 Agent 按需读取。

验收标准：

- 回答中的每个数据结论能链接回具体文件和记录；
- 文件不可读、格式不支持或数据不足时明确说明，不能假装已分析。

#### P0-3：建立可审计的证据引用

目标：使每个关键结论都可验证。

建议的引用对象格式：

```text
证据 E-017
文件：rank6/kernel_details.csv
数据范围：rows 1821-1884
字段：Name, Duration, Input Shapes
过滤条件：Type=MatMulV2
聚合：sum(Duration), count(*)
工具：compute_op_sum
```

UI 上应支持：

- 点击结论查看证据抽屉；
- 从证据跳转到表格、泳道或源文件；
- 复制结论时连同证据编号复制；
- 导出完整诊断包，包括原始依据和分析步骤。

#### P0-4：建立诊断安全边界

需要实现：

- 明确区分事实、推断、建议和预测；
- 结论显示置信度及缺失数据；
- 对“修改系统参数”“修改并行策略”等高影响建议要求用户确认；
- 给收益预测提供计算方法和上下限；
- 提醒用户复采验证，不能把预测当成已实现收益。

### P1：形成差异化竞争力

#### P1-1：优化前后 Baseline 对比闭环

参考 Nsight 的 baseline 思路，支持：

```text
发现问题
→ 生成修改建议或 patch
→ 用户执行/确认
→ 重新采集
→ 自动比较前后结果
→ 判断建议是否有效
```

对比项至少包括：

- step time；
- MFU；
- 各 Rank 计算时间离散度；
- 暴露通信时间；
- pipeline bubble；
- 算子时间；
- 显存；
- 频率；
- 吞吐与稳定性。

#### P1-2：建立分布式训练诊断规则库

优先覆盖：

- 硬件型慢卡；
- PP stage 负载不均；
- DP/TP/PP 通信未重叠；
- 链路带宽未达标；
- 小包通信；
- rank mapping 或 NUMA 绑定错误；
- host 下发不足；
- 动态 shape 和在线编译；
- 显存碎片与 OOM 风险；
- 频率、功耗墙和温度问题；
- 数据加载和 checkpoint 抖动。

规则输出要包含：触发条件、反例条件、需要补采的数据、证据和建议。

#### P1-3：把双向视图联动产品化

现有“泳道到对话、对话到泳道”是重要优势，应扩展到：

- 表格行；
- Rank；
- 通信 group；
- step；
- 算子；
- module；
- 告警；
- 优化前后差异。

右键“智能分析”不应只生成提示词，而应携带结构化对象 ID 和当前筛选条件。

#### P1-4：让 Agent、模型和 Build/Plan 名副其实

建议定义：

- **Plan**：只分析、列计划，不执行命令或修改文件；
- **Build**：在用户授权后运行分析命令、生成报告或 patch；
- **MS Insight Native**：拥有完整性能工具权限和领域规则；
- **通用模型**：只负责总结或语言生成，不直接宣称执行性能工具。

界面应显示本轮实际使用的模型、工具和权限，而不只是切换名称。

#### P1-5：领域 RAG 与版本管理

知识库至少包含：

- CANN、PyTorch NPU、MindSpeed、Megatron 和 HCCL 官方文档；
- msprof、msprof-analyze、advisor 的版本化文档；
- 芯片规格与理论峰值；
- 并行策略最佳实践；
- 已验证的历史案例。

回答中的知识性建议必须附带版本和来源链接，避免把旧版本参数用于新环境。

### P2：补齐产品易用性与平台能力

#### P2-1：会话管理

- 实现历史会话列表；
- 按任务、采集目录和时间筛选；
- 保留每轮上下文和工具日志；
- 支持导出、分享和再次打开；
- 对数据文件移动或变化给出提示。

#### P2-2：上下文与隐私控制

参考 Nsight Copilot 的“眼睛”设计：

- 明确显示当前附加目录和文件；
- 单独控制某个上下文是否参与本轮请求；
- 发送前显示数据去向；
- 支持敏感字段脱敏；
- 支持完全离线和企业私有化模型。

#### P2-3：报告操作

- Retry；
- Copy；
- Save；
- 导出 Markdown/PDF；
- 有用/无用反馈；
- 对某个结论继续追问；
- 将建议转成任务或 patch；
- 将多次分析合并成对比报告。

#### P2-4：完成当前占位入口

需要补齐或暂时隐藏：

- 历史对话；
- 语音输入；
- 添加 Agent；
- Agent 刷新；
- `/` 指令的真实执行；
- Build/Plan 的实际差异。

#### P2-5：降低前端直连风险

- 不在页面脚本中直接处理长期 API Key；
- 使用后端凭据代理或企业凭据服务；
- 对请求进行权限、限流和审计；
- 对 Profiling 数据做脱敏和体积控制；
- 允许管理员限定可用模型和数据范围。

---

## 八、推荐产品定位文案

推荐主定位：

> **面向大模型分布式训练的性能调查 Agent。自动读取多 Rank Profiling 数据，运行专业分析工具，交叉验证计算、通信与调度证据，输出按收益排序、可回到原始数据验证的优化方案。**

推荐差异化表达：

- 比通用 profiler 更懂训练拓扑；
- 比普通 RAG 更懂性能证据；
- 比传统报告更接近最终整改决策；
- 从数据采集、诊断、修改建议到复采验证形成闭环。

应避免的过度承诺：

- “完全替代 Nsight Compute”；
- “AI 自动保证性能提升”；
- “选择文件名即代表已经读取文件”；
- “展示思考步骤即代表已经真实执行工具”。

---

## 九、来源链接汇总

NVIDIA Nsight AI：

```text
https://developer.nvidia.com/nsight-ai
```

Nsight Compute 产品页：

```text
https://developer.nvidia.com/nsight-compute/
```

Nsight Compute 文档：

```text
https://docs.nvidia.com/nsight-compute/
```

Nsight Compute Copilot 集成文档：

```text
https://docs.nvidia.com/cuda/developer-preview/13.4/nsight-compute/NsightCompute/index.html#nsight-copilot
```

Nsight Compute 下载页：

```text
https://developer.nvidia.com/tools-overview/nsight-compute/get-started
```

Nsight Systems 产品页：

```text
https://developer.nvidia.com/nsight-systems
```

Nsight Systems 用户指南：

```text
https://docs.nvidia.com/nsight-systems/UserGuide/
```

Nsight Copilot Blueprint：

```text
https://github.com/NVIDIA-AI-Blueprints/nsight-copilot
```

Blueprint README：

```text
https://github.com/NVIDIA-AI-Blueprints/nsight-copilot/blob/main/README.md
```

Blueprint 部署说明：

```text
https://github.com/NVIDIA-AI-Blueprints/nsight-copilot/blob/main/docs/deploy-docker-self-hosted.md
```

512 GPU 通信优化案例：

```text
https://developer.nvidia.com/blog/nvidia-exemplar-cloud-lessons-for-unlocking-full-performance-on-ai-infrastructure/
```

ResNet50 优化案例：

```text
https://developer.nvidia.com/blog/profiling-and-optimizing-deep-neural-networks-with-dlprof-and-pyprof/
```

访存和寄存器优化案例：

```text
https://developer.nvidia.com/blog/boosting-application-performance-with-gpu-memory-access-tuning/
```

Guided Analysis、问题排序和源码标记：

```text
https://developer.nvidia.com/blog/nvidia-cuda-toolkit-12-2-unleashes-powerful-features-for-boosting-applications/
```

Wolfenstein 卡顿案例：

```text
https://developer.nvidia.com/blog/using-nsight-systems-for-fixing-stutters-in-games/
```
