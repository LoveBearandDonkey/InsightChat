/* Fixed fictional workspace and story data. */
window.DEMO = {
  "user": { "name": "LinLan_AscendLab" },
  "project": "xinghe-moe-training",
  "files": {
    "README.md": "# 星河 · 64 卡缩到 32 卡\n\n林岚今晚只有一半的 NPU 卡。\n目标：GBS=128、序列 16K、模型 / Top-K / 数值策略不变。\n本轮不占卡。\n\n1. 对照 configs/baseline-64.yaml 与 configs/model.yaml\n2. 核对 DP / EP 分组\n3. 仅修 EP，查看逐 Stage 理论容量\n4. 比较 A/B 候选，保留所选 Diff\n5. 导出带来源、容量依据和待验项的配置包\n\n所有结论为固定故事回放；不解析任意配置，不调用 MCP 或训练。\n",
    "configs/model.yaml": "# 星河 MoE · S1 构造样例（演示数据）\n# 字段为演示解析口径，非可直接运行的框架启动契约\nmodel:\n  name: S1-synthetic-MoE\n  num_layers: 32\n  hidden_size: 4096\n  num_attention_heads: 32\n  num_key_value_heads: 8\n  ffn_hidden_size: 11008\n  expert_ffn_hidden_size: 5632\n  vocab_size: 32000\n  num_experts: 8\n  top_k: 2\n  shared_experts: 1\n  seq_length: 16384\ntraining:\n  global_batch_size: 128\n  micro_batch_size: 2\n  micro_batch_count: 16\n  precision: bf16\n  parameter_dtype: fp32\nparallel:\n  data_parallel_size: 4\n  tensor_model_parallel_size: 2\n  pipeline_model_parallel_size: 4\n  context_parallel_size: 1\n  expert_model_parallel_size: 8\n  expert_parallel_mode: split\n  sequence_parallel: true\n  vocab_embedding_data_parallel: true\n  expert_tensor_parallel: false\n  virtual_pipeline_size: 1\n  pipeline_layer_mode: uniform\nrecompute:\n  granularity: selective\noptimizer:\n  type: adamw\n  shard_mode: none\ncheckpoint:\n  load: artifacts/64card-checkpoint\n  resume_data_progress: preserve\ncluster:\n  total_ranks: 32\n  ranks_per_node: 8\n  card_memory_gib: 64\n",
    "configs/runtime.yaml": "# 显式资源声明，不代表读取实机\nruntime:\n  host: npu-dev-01\n  queue: npu-validation\n  total_ranks: 32\n  nodes: 4\n  ranks_per_node: 8\n  card_memory_gib: 64\n  device_profile: synthetic-64GiB\n  framework: team-pinned-build\n",
    "scripts/train_npu.sh": "#!/usr/bin/env bash\n# S1 启动入口示意，未执行训练\n# 固定故事使用归一化配置；实际框架映射仍需核对\nCONFIG=configs/model.yaml\n# torchrun / YAML 接入由目标框架与版本决定\necho \"Demo only: $CONFIG / 32 ranks / 16K / GBS 128\"\n",
    "src/train.py": "\"\"\"星河训练入口 · 演示代码，未连接训练环境。\"\"\"\nfrom pathlib import Path\n\ndef train(config_path):\n    # 实际产品由固定版本的训练框架解析配置\n    config = Path(config_path).read_text()\n    return {\"config\": config, \"mode\": \"demo\"}\n\nif __name__ == \"__main__\":\n    print(\"请在受支持的训练环境中运行\")\n",
    "src/model/moe.py": "\"\"\"MoE 模型结构占位，用于工程导航演示。\"\"\"\n\nclass XingheMoE:\n    def __init__(self, num_experts=8):\n        self.num_experts = num_experts\n\n    def forward(self, hidden_states):\n        raise NotImplementedError(\"演示工程，不执行训练\")\n",
    "data/dataset_manifest.json": "{\n  \"dataset\": \"xinghe-pretrain-v3\",\n  \"sequence_length\": 16384,\n  \"sample_policy\": \"fixed-seed\",\n  \"resume_progress\": \"preserve; unverified\",\n  \"demo\": true\n}\n",
    ".mcp.json": "{\n  \"_note\": \"2027 概念连接示意，未配置真实服务\",\n  \"mcpServers\": {\n    \"mindstudio-config\": {\n      \"type\": \"http\",\n      \"url\": \"https://YOUR-MS-SERVICE/mcp\"\n    }\n  }\n}\n",
    "configs/baseline-64.yaml": "# 星河 MoE · S1 构造样例（演示数据）\n# 字段为演示解析口径，非可直接运行的框架启动契约\nmodel:\n  name: S1-synthetic-MoE\n  num_layers: 32\n  hidden_size: 4096\n  num_attention_heads: 32\n  num_key_value_heads: 8\n  ffn_hidden_size: 11008\n  expert_ffn_hidden_size: 5632\n  vocab_size: 32000\n  num_experts: 8\n  top_k: 2\n  shared_experts: 1\n  seq_length: 16384\ntraining:\n  global_batch_size: 128\n  micro_batch_size: 1\n  micro_batch_count: 16\n  precision: bf16\n  parameter_dtype: fp32\nparallel:\n  data_parallel_size: 8\n  tensor_model_parallel_size: 2\n  pipeline_model_parallel_size: 4\n  context_parallel_size: 1\n  expert_model_parallel_size: 8\n  expert_parallel_mode: split\n  sequence_parallel: true\n  vocab_embedding_data_parallel: true\n  expert_tensor_parallel: false\n  virtual_pipeline_size: 1\n  pipeline_layer_mode: uniform\nrecompute:\n  granularity: selective\noptimizer:\n  type: adamw\n  shard_mode: zero1\ncheckpoint:\n  load: artifacts/64card-checkpoint\n  resume_data_progress: preserve\ncluster:\n  total_ranks: 64\n  ranks_per_node: 8\n  card_memory_gib: 64\n",
    "outputs/README.md": "# 尚无本次运行证据\n\n本轮只做静态规则和理论容量筛选。\n没有 Tinker 测量包，没有启动真机作业。\ncheckpoint 元数据、恢复语义、实测峰值与性能均待核对。\n"
  },
  "stories": [
    {
      "id": "S1",
      "short": "配置校验",
      "title": "64 卡缩到 32 卡，分组修好了，为什么仍可能 OOM？",
      "role": "林岚 · 训练工程师",
      "file": "configs/model.yaml",
      "description": "保持 GBS=128、16K、模型与数值策略。先在原 IDE 检查分组，再比较理论容量与仿真缺口，本轮不占卡。",
      "prompt": "这份 64 卡配置要换到 32 卡。我改了 DP 和微批，也用了小集群模板。全局 batch 128、16K 和数值策略别变。先查分组和潜在 OOM，今天先别占卡。",
      "handoff": "四处 Diff → 分组阻断 → 理论容量 → A/B 取舍 → 配置包"
    },
    {
      "id": "S2",
      "short": "精度对齐",
      "title": "loss 分叉了，先查哪里？",
      "role": "周澄 · 精度工程师",
      "file": "src/model/moe.py",
      "description": "从 msAgent CLI/TUI 提交成对运行，在 GUI 接续同一任务；先确认输入可比，再逐轮取证与回归。",
      "prompt": "查这次 GPU / NPU loss 分叉，沿用团队登记的误差定义。先别改代码。",
      "handoff": "CLI 发起 → GUI 接续 → Insight 精度证据 → IDE 审阅"
    },
    {
      "id": "S3",
      "short": "显存与 OOM",
      "title": "小规模跑通，长序列怎么又炸了？",
      "role": "林岚 · 训练工程师",
      "file": "configs/model.yaml",
      "description": "主入口为 Insight 专业工作台。导入失败现场，解释容量差额，比较内存与时间取舍，最后回放失败负载。",
      "prompt": "检查长序列训练的 OOM 现场，保持训练语义和性能底线，先解释峰值来自哪里。",
      "handoff": "Insight 现场 → 内存证据 → 容量取舍 → 失败负载重放"
    },
    {
      "id": "S4",
      "short": "性能调优",
      "title": "通信等待这么长，要改通信参数吗？",
      "role": "陈越 · 性能工程师",
      "file": "src/train.py",
      "description": "从 Insight 已有助手与 Timeline 继续。演出补采失败、用户纠偏、持续任务与一轮受控实验。",
      "prompt": "分析本次训练的通信等待。先核对前置计算，不要直接改通信参数。",
      "handoff": "Insight 首轮分析 → 补采与纠偏 → 最小实验 → 业务复验"
    },
    {
      "id": "S5",
      "short": "迁移验收",
      "title": "可以交付了吗？先看哪些还不能比较。",
      "role": "许宁 · 迁移负责人",
      "file": "README.md",
      "description": "主入口为 msAgent GUI 的项目交付任务。聚合配置、精度和性能证据，版本变化使旧结论失效，缺项暂缓交付。",
      "prompt": "汇总 GPU → NPU 迁移验收，标出不可比较项、失效证据和需要补验的范围。",
      "handoff": "msAgent 交付任务 → 聚合证据 → 定向补验 → 限定范围验收"
    },
    {
      "id": "S6",
      "short": "仿真规划",
      "title": "资源没到齐，先测哪两个方案？",
      "role": "苏禾 · 服务架构师",
      "file": "configs/runtime.yaml",
      "description": "主入口为 msModeling Web UI。引用训练产物，在业务约束下安排校准，并关联最终真实压测。",
      "prompt": "在现有资源预算下规划推理容量，区分仿真估计与真实测量，先选最有价值的校准方案。",
      "handoff": "Modeling 业务约束 → 候选仿真 → 校准 → 真实压测"
    }
  ],
  "steps": [
    [
      "今晚只有 32 卡，训练目标不变",
      "林岚已改过 DP 和微批，又换了集群模板。先检查，不占卡。",
      "开始：对照 64 → 32 卡"
    ],
    [
      "四处变化，batch 看起来没变",
      "同为 GBS=128，分组和单卡峰值却可能已经不同。",
      "查看 DP / EP 分组阻断"
    ],
    [
      "先修确定的分组冲突",
      "world 已匹配 32；DP=4 无法组成 EP=8，非法配置先不画容量。",
      "复核：只把 EP 改成 4"
    ],
    [
      "分组修好了，为什么仍可能 OOM？",
      "仅修 EP 后，Stage 0 理论 68.61 GiB，超过 64 GiB 示例容量。",
      "展开三类内存联动"
    ],
    [
      "GBS 相同，不代表单卡峰值相同",
      "专家更多、激活翻倍、分片关闭，三处变化叠加。",
      "比较保持目标的 A / B 方案"
    ],
    [
      "给出两个取舍，把选择权留给她",
      "A 减微批增累积；B 加重计算。都保留 GBS=128、16K 与数值策略。",
      "检查仿真测量依据"
    ],
    [
      "没有测量包，就如实停在估算",
      "没有执行 Tinker；没有步时和收益，仍可交付有依据的候选。",
      "审阅所选方案 Diff"
    ],
    [
      "在原 IDE 审阅，再保留修改",
      "仅修改候选需要的字段；锁定训练目标与恢复进度。",
      "保留所选方案"
    ],
    [
      "静态通过，运行仍待验证",
      "带上容量依据与未验证项，本轮不用占卡也能交付。",
      "导出缩卡配置包"
    ],
    [
      "配置与依据一起交付，故事讲完",
      "她已知道哪些方案不该跑，以及下一次上机究竟要验证什么。",
      "重新演示故事 1"
    ]
  ]
};
