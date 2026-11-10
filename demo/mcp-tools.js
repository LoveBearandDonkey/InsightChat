/* Self-contained example inventory for the public demo.
   These are proposed task-level contracts, not implemented MCP tool claims. */
window.MS_AGENT_TOOL_CATALOG=Object.freeze({
  "source": {
    "path": "mcp-tools.js",
    "label": "MindStudio MCP 示例工具清单",
    "status": "prototype"
  },
  "tools": [
    {
      "group": "task",
      "name": "create_task",
      "description": "创建目标、输入版本与边界明确的任务"
    },
    {
      "group": "task",
      "name": "get_task",
      "description": "读取任务阶段、结论、证据索引与版本"
    },
    {
      "group": "task",
      "name": "list_tasks",
      "description": "按项目和权限查询可见任务"
    },
    {
      "group": "task",
      "name": "attach_artifact",
      "description": "将有来源和版本的产物关联到任务"
    },
    {
      "group": "task",
      "name": "get_artifact",
      "description": "读取受权限约束的产物元数据及内容引用"
    },
    {
      "group": "task",
      "name": "get_job",
      "description": "查询作业及真实执行状态"
    },
    {
      "group": "task",
      "name": "cancel_job",
      "description": "请求取消指定作业，按实际执行结果更新状态"
    },
    {
      "group": "task",
      "name": "take_control",
      "description": "在可交接状态下，以版本/控制租约转移任务控制权"
    },
    {
      "group": "training",
      "name": "resolve_training_config",
      "description": "解析配置来源链，保留未知动态分支"
    },
    {
      "group": "training",
      "name": "check_training_config",
      "description": "按版本化规则检查约束与未生效风险"
    },
    {
      "group": "training",
      "name": "plan_training_trial",
      "description": "先给静态/容量筛选方案，核对 Tinker 测量包与模拟支持，缺证据时才规划真机校准/启动验证"
    },
    {
      "group": "training",
      "name": "submit_training_trial",
      "description": "目标契约区分离线模拟与真机 profile/短测；按已确认规格和资源边界提交，具体适配逐项验收"
    },
    {
      "group": "training",
      "name": "get_training_trial_result",
      "description": "分开汇总静态、theoretical、测量支持的模拟及实测，保留数据来源、适用范围和未覆盖项"
    },
    {
      "group": "precision",
      "name": "check_comparability",
      "description": "核对运行对、输入和误差定义是否可比"
    },
    {
      "group": "precision",
      "name": "build_semantic_mapping",
      "description": "创建或按版本修订语义映射"
    },
    {
      "group": "precision",
      "name": "plan_precision_capture",
      "description": "形成可审阅、受限的取证规格"
    },
    {
      "group": "precision",
      "name": "submit_precision_capture",
      "description": "执行受支持的 dump/重放采集"
    },
    {
      "group": "precision",
      "name": "compare_precision",
      "description": "比较指定产物与映射版本，输出通过/异常/未知"
    },
    {
      "group": "precision",
      "name": "submit_precision_validation",
      "description": "提交局部干预或整网复验，范围和变更显式入参"
    },
    {
      "group": "memory",
      "name": "inspect_memory_capture",
      "description": "检查 OOM 现场来源、数据完整性与口径"
    },
    {
      "group": "memory",
      "name": "plan_memory_capture",
      "description": "形成缺失生命周期/快照等数据的采集方案"
    },
    {
      "group": "memory",
      "name": "submit_memory_capture",
      "description": "提交受支持的采集作业"
    },
    {
      "group": "memory",
      "name": "analyze_memory",
      "description": "解释占用、峰值与容量差额，保留证据缺口"
    },
    {
      "group": "memory",
      "name": "submit_memory_trial",
      "description": "重放失败负载或验证受限内存方案"
    },
    {
      "group": "performance",
      "name": "inspect_profile",
      "description": "检查 profiling 配置、完整性和可判范围"
    },
    {
      "group": "performance",
      "name": "plan_profile_capture",
      "description": "按问题及环境前置形成最小补采规格"
    },
    {
      "group": "performance",
      "name": "submit_profile_capture",
      "description": "提交满足前置的采集作业，失败独立记录"
    },
    {
      "group": "performance",
      "name": "analyze_profile",
      "description": "运行支持的分析 recipe，返回结构化发现和锚点"
    },
    {
      "group": "performance",
      "name": "compare_profile",
      "description": "在固定口径下比较运行，标出版本与覆盖差异"
    },
    {
      "group": "performance",
      "name": "submit_performance_trial",
      "description": "按明确变更、工作负载和预算提交性能实验"
    },
    {
      "group": "operator",
      "name": "profile_operator",
      "description": "按支持的真机/仿真方式做算子剖析"
    },
    {
      "group": "operator",
      "name": "predict_kernel_performance",
      "description": "用显式假设建立上限模型，估计与实测分开"
    },
    {
      "group": "operator",
      "name": "run_kernel_trial",
      "description": "在隔离环境执行有输入约束的 kernel 实验"
    },
    {
      "group": "operator",
      "name": "generate_operator_project",
      "description": "在指定工作区生成/构建算子工程，写入范围明确"
    },
    {
      "group": "operator",
      "name": "check_operator_correctness",
      "description": "发起受限检测/调试辅助；需人工调试时返回待介入状态"
    },
    {
      "group": "modeling",
      "name": "simulate_service",
      "description": "按模型、硬件画像与负载假设运行推理仿真"
    },
    {
      "group": "modeling",
      "name": "rank_candidates",
      "description": "按预算、SLO 和证据可信范围排列候选"
    },
    {
      "group": "modeling",
      "name": "submit_service_calibration",
      "description": "提交代表配置实测/服务采集并形成校准产物"
    },
    {
      "group": "modeling",
      "name": "analyze_service_trace",
      "description": "分析请求链路和设备证据，解释预测偏差"
    },
    {
      "group": "modeling",
      "name": "submit_quantization_trial",
      "description": "生成新版本量化候选并提交指定评估，不能沿用旧精度结论"
    }
  ]
});
