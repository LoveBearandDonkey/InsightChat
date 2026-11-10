/* Derived from the S1 scenario record. No execution takes place in the browser. */
window.S1_EVIDENCE = {
  "source": "s1-evidence.js",
  "notice": "??????? config-core ???????? MCP ??? NPU ??",
  "mappedFields": 42,
  "cases": [
    {
      "name": "baseline",
      "input": {
        "schema_version": "1.0",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "model": {
          "id": "S1-synthetic-MoE-not-a-released-model",
          "total_layers": 32,
          "hidden_size": 4096,
          "num_attention_heads": 32,
          "num_key_value_heads": 8,
          "ffn_hidden_size": 11008,
          "expert_ffn_hidden_size": 5632,
          "vocab_size": 32000,
          "routed_experts": 8,
          "top_k": 2,
          "shared_experts": 1,
          "first_k_dense_layers": 0
        },
        "parallel": {
          "dp": 8,
          "pp": 4,
          "tp": 2,
          "cp": 1,
          "ep": 8,
          "vpp": 1,
          "pipeline_layer_mode": "uniform",
          "ep_mode": "split",
          "cp_mode": "ulysses",
          "sequence_parallel": true,
          "vocab_embedding_data_parallel": true,
          "expert_tensor_parallel": false
        },
        "cluster": {
          "total_ranks": 64,
          "ranks_per_node": 8,
          "card_model": "synthetic NPU 64 GiB profile",
          "card_memory_gib": 64
        },
        "batch": {
          "micro_batch_size": 1,
          "sequence_length": 16384,
          "micro_batch_count": 16,
          "global_batch_size": 128
        },
        "memory": {
          "compute_dtype": "bf16",
          "parameter_dtype": "fp32",
          "recompute_mode": "selective",
          "shard_mode": "zero1",
          "lora_enabled": false
        },
        "policy": {
          "locked_fields": [],
          "objective": "minimal-change"
        }
      },
      "validation": {
        "schema_version": "1.0",
        "tool": "validate_parallel_config",
        "status": "valid",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "source_versions": {
          "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
          "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
          "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
          "config_core": "0.1.1"
        },
        "errors": [],
        "warnings": [],
        "suggestions": [
          {
            "code": "MINDSPEED_HCCL_GROUP_BUFFER_ADAPTIVE",
            "kind": "advisory",
            "confidence": "theoretical",
            "message": "HCCL 通信域当前使用统一 200 MiB Buffer；仅在显存偏满或 OOM 时评估自适应。",
            "fields": [
              "batch.sequence_length",
              "batch.micro_batch_size",
              "model.hidden_size",
              "parallel.tp",
              "parallel.cp",
              "parallel.ep",
              "features.hccl_group_buffer_adaptive"
            ],
            "applicable_hardware": [
              "昇腾 NPU"
            ],
            "applicable_versions": [
              "MindSpeed 0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
              "TorchNPU FrameworkPTAdapter >= 7.0.RC1.B020"
            ],
            "assumptions": [
              "Buffer 数值单位为 MiB，并按 MindSpeed 锁定版本中的自适应公式计算。",
              "未显式配置 MoE EP 负载不均衡系数；按 MindSpeed 默认行为将 EP 相关通信域保留为 200 MiB。",
              "该建议只描述静态配置方向，不代表性能收益已经通过 Profiling 校准。"
            ],
            "source": "mindspeed-rule",
            "source_ref": "MindSpeed:docs/zh/features/hccl-group-buffer-set.md@6563468; MindSpeed:mindspeed/core/hccl_buffer/hccl_adaptive_func.py:83-263@6563468",
            "data": {
              "unit": "MiB",
              "ep_load_imbalance_factor": null,
              "ep_factor_configured": false,
              "enabled": false,
              "groups": {
                "tp": 128,
                "pp": 64,
                "pp_new_stream": 64,
                "mp": 10,
                "mp_exp": 10,
                "tp_cp": 10,
                "exp": 200,
                "cp": 64
              },
              "action": "仅当理论容量偏满、实测显存紧张或发生 OOM 时，确认版本兼容后试加 --hccl-group-buffer-adaptive，并对比峰值显存与吞吐。",
              "impact_if_ignored": "配置和训练正确性不受影响；显存紧张时可能错失通信 Buffer 的节省空间。"
            }
          }
        ],
        "assumptions": [
          "只校验表单和 rule_profile 对应上游中已建模的静态约束，不代表目标环境已经实机运行通过。"
        ],
        "confidence": "deterministic",
        "data": {
          "valid": true,
          "world_size": 64,
          "ep_mode": "split",
          "pipeline_layer_mode": "uniform",
          "pipeline_stage_layers": null,
          "ep_domain": 8,
          "expert_data_parallel": 1
        },
        "quick_assessment": {
          "state": "passed",
          "conclusion": "配置通过已建模静态校验。",
          "evidence": [],
          "next_step": "如需确认可运行性，在目标环境继续验证。",
          "limitation": "静态通过不代表实机训练通过。"
        }
      },
      "stages": [
        {
          "stage": 0,
          "layers": 8,
          "parameter_count_on_card": 1230241792,
          "trainable_parameter_count_on_card": 1230241792,
          "capacity_gib": 64,
          "total_gib": 37.46719970703125,
          "ratio": 0.5854249954223633,
          "level": "safe",
          "inflight_micro_batches": 4,
          "full_pipeline_inflight": 4,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 4.5830078125,
            "gradient": 4.5830078125,
            "optimizer": 4.755126953125,
            "activation": 17,
            "reserve": 4.54605712890625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.5460571289062501,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 1,
          "layers": 8,
          "parameter_count_on_card": 1099169792,
          "trainable_parameter_count_on_card": 1099169792,
          "capacity_gib": 64,
          "total_gib": 31.85113525390625,
          "ratio": 0.49767398834228516,
          "level": "safe",
          "inflight_micro_batches": 3,
          "full_pipeline_inflight": 3,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 4.0947265625,
            "gradient": 4.0947265625,
            "optimizer": 4.633056640625,
            "activation": 12.75,
            "reserve": 4.27862548828125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.27862548828125,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 2,
          "layers": 8,
          "parameter_count_on_card": 1099169792,
          "trainable_parameter_count_on_card": 1099169792,
          "capacity_gib": 64,
          "total_gib": 27.38863525390625,
          "ratio": 0.4279474258422852,
          "level": "safe",
          "inflight_micro_batches": 2,
          "full_pipeline_inflight": 2,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 4.0947265625,
            "gradient": 4.0947265625,
            "optimizer": 4.633056640625,
            "activation": 8.5,
            "reserve": 4.06612548828125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.06612548828125,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 3,
          "layers": 8,
          "parameter_count_on_card": 1230241792,
          "trainable_parameter_count_on_card": 1230241792,
          "capacity_gib": 64,
          "total_gib": 24.07969970703125,
          "ratio": 0.37624530792236327,
          "level": "safe",
          "inflight_micro_batches": 1,
          "full_pipeline_inflight": 1,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 4.5830078125,
            "gradient": 4.5830078125,
            "optimizer": 4.755126953125,
            "activation": 4.25,
            "reserve": 3.90855712890625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 0.9085571289062501,
            "fsdp_unshard": 0
          }
        }
      ],
      "capacityAssumptions": [
        "结果复现页面六段容量口径，属于理论估算，不是设备实测峰值。",
        "运行时底座、HCCL buffer、workspace、碎片率和 FSDP2 预取深度使用页面经验系数。",
        "80% 警戒线是未校准的保守策略：当前估算已含运行时预留，仍额外保留 20% 以覆盖静态估算误差；它不是框架 OOM 标准。"
      ],
      "capacityConfidence": "theoretical",
      "sourceVersions": {
        "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
        "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
        "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
        "config_core": "0.1.1"
      }
    },
    {
      "name": "draft",
      "input": {
        "schema_version": "1.0",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "model": {
          "id": "S1-synthetic-MoE-not-a-released-model",
          "total_layers": 32,
          "hidden_size": 4096,
          "num_attention_heads": 32,
          "num_key_value_heads": 8,
          "ffn_hidden_size": 11008,
          "expert_ffn_hidden_size": 5632,
          "vocab_size": 32000,
          "routed_experts": 8,
          "top_k": 2,
          "shared_experts": 1,
          "first_k_dense_layers": 0
        },
        "parallel": {
          "dp": 4,
          "pp": 4,
          "tp": 2,
          "cp": 1,
          "ep": 8,
          "vpp": 1,
          "pipeline_layer_mode": "uniform",
          "ep_mode": "split",
          "cp_mode": "ulysses",
          "sequence_parallel": true,
          "vocab_embedding_data_parallel": true,
          "expert_tensor_parallel": false
        },
        "cluster": {
          "total_ranks": 32,
          "ranks_per_node": 8,
          "card_model": "synthetic NPU 64 GiB profile",
          "card_memory_gib": 64
        },
        "batch": {
          "micro_batch_size": 2,
          "sequence_length": 16384,
          "micro_batch_count": 16,
          "global_batch_size": 128
        },
        "memory": {
          "compute_dtype": "bf16",
          "parameter_dtype": "fp32",
          "recompute_mode": "selective",
          "shard_mode": "none",
          "lora_enabled": false
        },
        "policy": {
          "locked_fields": [],
          "objective": "minimal-change"
        }
      },
      "validation": {
        "schema_version": "1.0",
        "tool": "validate_parallel_config",
        "status": "invalid",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "source_versions": {
          "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
          "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
          "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
          "config_core": "0.1.1"
        },
        "errors": [
          {
            "code": "PAGE_EP_DOMAIN_DIVISIBLE_BY_EP",
            "message": "切出口径下，DP 4 不能被 EP 8 整除。",
            "fields": [
              "parallel.dp",
              "parallel.ep"
            ],
            "source": "page-rule",
            "source_ref": "compute-graph-viewer-wzh:shared/plane-rules.js@1e6bb6e",
            "formula": "dp % ep === 0"
          }
        ],
        "warnings": [],
        "suggestions": [],
        "assumptions": [
          "只校验表单和 rule_profile 对应上游中已建模的静态约束，不代表目标环境已经实机运行通过。"
        ],
        "confidence": "deterministic",
        "data": {
          "valid": false,
          "world_size": 32,
          "ep_mode": "split",
          "pipeline_layer_mode": "uniform",
          "pipeline_stage_layers": null,
          "ep_domain": 4,
          "expert_data_parallel": 1
        },
        "quick_assessment": {
          "state": "blocked",
          "conclusion": "当前配置存在阻断问题。",
          "evidence": [
            {
              "code": "PAGE_EP_DOMAIN_DIVISIBLE_BY_EP",
              "message": "切出口径下，DP 4 不能被 EP 8 整除。",
              "fields": [
                "parallel.dp",
                "parallel.ep"
              ],
              "source": "page-rule",
              "source_ref": "compute-graph-viewer-wzh:shared/plane-rules.js@1e6bb6e",
              "formula": "dp % ep === 0"
            }
          ],
          "next_step": "先处理所列静态问题，再用修改后的配置重新校验。",
          "limitation": "静态结论不等于目标环境的训练运行结果。"
        }
      },
      "stages": null,
      "capacityAssumptions": [
        "只校验表单和 rule_profile 对应上游中已建模的静态约束，不代表目标环境已经实机运行通过。"
      ],
      "capacityConfidence": "theoretical",
      "sourceVersions": {
        "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
        "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
        "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
        "config_core": "0.1.1"
      }
    },
    {
      "name": "groupOnly",
      "input": {
        "schema_version": "1.0",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "model": {
          "id": "S1-synthetic-MoE-not-a-released-model",
          "total_layers": 32,
          "hidden_size": 4096,
          "num_attention_heads": 32,
          "num_key_value_heads": 8,
          "ffn_hidden_size": 11008,
          "expert_ffn_hidden_size": 5632,
          "vocab_size": 32000,
          "routed_experts": 8,
          "top_k": 2,
          "shared_experts": 1,
          "first_k_dense_layers": 0
        },
        "parallel": {
          "dp": 4,
          "pp": 4,
          "tp": 2,
          "cp": 1,
          "ep": 4,
          "vpp": 1,
          "pipeline_layer_mode": "uniform",
          "ep_mode": "split",
          "cp_mode": "ulysses",
          "sequence_parallel": true,
          "vocab_embedding_data_parallel": true,
          "expert_tensor_parallel": false
        },
        "cluster": {
          "total_ranks": 32,
          "ranks_per_node": 8,
          "card_model": "synthetic NPU 64 GiB profile",
          "card_memory_gib": 64
        },
        "batch": {
          "micro_batch_size": 2,
          "sequence_length": 16384,
          "micro_batch_count": 16,
          "global_batch_size": 128
        },
        "memory": {
          "compute_dtype": "bf16",
          "parameter_dtype": "fp32",
          "recompute_mode": "selective",
          "shard_mode": "none",
          "lora_enabled": false
        },
        "policy": {
          "locked_fields": [],
          "objective": "minimal-change"
        }
      },
      "validation": {
        "schema_version": "1.0",
        "tool": "validate_parallel_config",
        "status": "valid",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "source_versions": {
          "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
          "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
          "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
          "config_core": "0.1.1"
        },
        "errors": [],
        "warnings": [],
        "suggestions": [
          {
            "code": "MINDSPEED_HCCL_GROUP_BUFFER_ADAPTIVE",
            "kind": "advisory",
            "confidence": "theoretical",
            "message": "HCCL 通信域当前使用统一 200 MiB Buffer；仅在显存偏满或 OOM 时评估自适应。",
            "fields": [
              "batch.sequence_length",
              "batch.micro_batch_size",
              "model.hidden_size",
              "parallel.tp",
              "parallel.cp",
              "parallel.ep",
              "features.hccl_group_buffer_adaptive"
            ],
            "applicable_hardware": [
              "昇腾 NPU"
            ],
            "applicable_versions": [
              "MindSpeed 0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
              "TorchNPU FrameworkPTAdapter >= 7.0.RC1.B020"
            ],
            "assumptions": [
              "Buffer 数值单位为 MiB，并按 MindSpeed 锁定版本中的自适应公式计算。",
              "未显式配置 MoE EP 负载不均衡系数；按 MindSpeed 默认行为将 EP 相关通信域保留为 200 MiB。",
              "该建议只描述静态配置方向，不代表性能收益已经通过 Profiling 校准。"
            ],
            "source": "mindspeed-rule",
            "source_ref": "MindSpeed:docs/zh/features/hccl-group-buffer-set.md@6563468; MindSpeed:mindspeed/core/hccl_buffer/hccl_adaptive_func.py:83-263@6563468",
            "data": {
              "unit": "MiB",
              "ep_load_imbalance_factor": null,
              "ep_factor_configured": false,
              "enabled": false,
              "groups": {
                "tp": 256,
                "pp": 128,
                "pp_new_stream": 128,
                "mp": 10,
                "mp_exp": 10,
                "tp_cp": 10,
                "exp": 200,
                "cp": 128
              },
              "action": "仅当理论容量偏满、实测显存紧张或发生 OOM 时，确认版本兼容后试加 --hccl-group-buffer-adaptive，并对比峰值显存与吞吐。",
              "impact_if_ignored": "配置和训练正确性不受影响；显存紧张时可能错失通信 Buffer 的节省空间。"
            }
          },
          {
            "code": "CONFIG_DP_OPTIMIZER_SHARD_CAPACITY_DIRECTION",
            "kind": "suggestion",
            "confidence": "theoretical",
            "message": "DP>1 且优化器状态未分片；若容量受优化器状态主导，可用 estimate_training_capacity 对比 zero1/fsdp2。",
            "fields": [
              "parallel.dp",
              "memory.shard_mode"
            ],
            "applicable_hardware": [
              "synthetic NPU 64 GiB profile"
            ],
            "applicable_versions": [
              "mindspeed-config-mcp 0.1.x"
            ],
            "assumptions": [
              "这是理论容量方向，不表示目标框架、版本和 checkpoint 流程已兼容对应分片模式。"
            ],
            "source": "page-rule",
            "source_ref": "mindspeed-config-mcp:estimate-training-capacity.js:activation-and-sharding@0.1.0",
            "data": {
              "compare_shard_modes": [
                "zero1",
                "fsdp2"
              ]
            }
          }
        ],
        "assumptions": [
          "只校验表单和 rule_profile 对应上游中已建模的静态约束，不代表目标环境已经实机运行通过。"
        ],
        "confidence": "deterministic",
        "data": {
          "valid": true,
          "world_size": 32,
          "ep_mode": "split",
          "pipeline_layer_mode": "uniform",
          "pipeline_stage_layers": null,
          "ep_domain": 4,
          "expert_data_parallel": 1
        },
        "quick_assessment": {
          "state": "review",
          "conclusion": "配置通过已建模静态校验，但有需要核对的提醒。",
          "evidence": [
            {
              "code": "CONFIG_DP_OPTIMIZER_SHARD_CAPACITY_DIRECTION",
              "message": "DP>1 且优化器状态未分片；若容量受优化器状态主导，可用 estimate_training_capacity 对比 zero1/fsdp2。",
              "fields": [
                "parallel.dp",
                "memory.shard_mode"
              ],
              "source": "page-rule",
              "source_ref": "mindspeed-config-mcp:estimate-training-capacity.js:activation-and-sharding@0.1.0"
            }
          ],
          "next_step": "核对提醒的依据与适用条件，再决定是否调整配置。",
          "limitation": "静态通过不代表实机训练通过。"
        }
      },
      "stages": [
        {
          "stage": 0,
          "layers": 8,
          "parameter_count_on_card": 1783889920,
          "trainable_parameter_count_on_card": 1783889920,
          "capacity_gib": 64,
          "total_gib": 68.6111328125,
          "ratio": 1.0720489501953125,
          "level": "over",
          "inflight_micro_batches": 4,
          "full_pipeline_inflight": 4,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.6455078125,
            "gradient": 6.6455078125,
            "optimizer": 13.291015625,
            "activation": 34,
            "reserve": 6.0291015625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 3.0291015625,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 1,
          "layers": 8,
          "parameter_count_on_card": 1652817920,
          "trainable_parameter_count_on_card": 1652817920,
          "capacity_gib": 64,
          "total_gib": 57.6353515625,
          "ratio": 0.9005523681640625,
          "level": "alert",
          "inflight_micro_batches": 3,
          "full_pipeline_inflight": 3,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.1572265625,
            "gradient": 6.1572265625,
            "optimizer": 12.314453125,
            "activation": 25.5,
            "reserve": 5.5064453125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 2.5064453125000004,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 2,
          "layers": 8,
          "parameter_count_on_card": 1652817920,
          "trainable_parameter_count_on_card": 1652817920,
          "capacity_gib": 64,
          "total_gib": 48.7103515625,
          "ratio": 0.7610992431640625,
          "level": "safe",
          "inflight_micro_batches": 2,
          "full_pipeline_inflight": 2,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.1572265625,
            "gradient": 6.1572265625,
            "optimizer": 12.314453125,
            "activation": 17,
            "reserve": 5.0814453125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 2.0814453125,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 3,
          "layers": 8,
          "parameter_count_on_card": 1783889920,
          "trainable_parameter_count_on_card": 1783889920,
          "capacity_gib": 64,
          "total_gib": 41.8361328125,
          "ratio": 0.6536895751953125,
          "level": "safe",
          "inflight_micro_batches": 1,
          "full_pipeline_inflight": 1,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.6455078125,
            "gradient": 6.6455078125,
            "optimizer": 13.291015625,
            "activation": 8.5,
            "reserve": 4.7541015625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.7541015625,
            "fsdp_unshard": 0
          }
        }
      ],
      "capacityAssumptions": [
        "结果复现页面六段容量口径，属于理论估算，不是设备实测峰值。",
        "运行时底座、HCCL buffer、workspace、碎片率和 FSDP2 预取深度使用页面经验系数。",
        "80% 警戒线是未校准的保守策略：当前估算已含运行时预留，仍额外保留 20% 以覆盖静态估算误差；它不是框架 OOM 标准。"
      ],
      "capacityConfidence": "theoretical",
      "sourceVersions": {
        "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
        "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
        "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
        "config_core": "0.1.1"
      }
    },
    {
      "name": "smallerMicro",
      "input": {
        "schema_version": "1.0",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "model": {
          "id": "S1-synthetic-MoE-not-a-released-model",
          "total_layers": 32,
          "hidden_size": 4096,
          "num_attention_heads": 32,
          "num_key_value_heads": 8,
          "ffn_hidden_size": 11008,
          "expert_ffn_hidden_size": 5632,
          "vocab_size": 32000,
          "routed_experts": 8,
          "top_k": 2,
          "shared_experts": 1,
          "first_k_dense_layers": 0
        },
        "parallel": {
          "dp": 4,
          "pp": 4,
          "tp": 2,
          "cp": 1,
          "ep": 4,
          "vpp": 1,
          "pipeline_layer_mode": "uniform",
          "ep_mode": "split",
          "cp_mode": "ulysses",
          "sequence_parallel": true,
          "vocab_embedding_data_parallel": true,
          "expert_tensor_parallel": false
        },
        "cluster": {
          "total_ranks": 32,
          "ranks_per_node": 8,
          "card_model": "synthetic NPU 64 GiB profile",
          "card_memory_gib": 64
        },
        "batch": {
          "micro_batch_size": 1,
          "sequence_length": 16384,
          "micro_batch_count": 32,
          "global_batch_size": 128
        },
        "memory": {
          "compute_dtype": "bf16",
          "parameter_dtype": "fp32",
          "recompute_mode": "selective",
          "shard_mode": "zero1",
          "lora_enabled": false
        },
        "policy": {
          "locked_fields": [],
          "objective": "minimal-change"
        }
      },
      "validation": {
        "schema_version": "1.0",
        "tool": "validate_parallel_config",
        "status": "valid",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "source_versions": {
          "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
          "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
          "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
          "config_core": "0.1.1"
        },
        "errors": [],
        "warnings": [],
        "suggestions": [
          {
            "code": "MINDSPEED_HCCL_GROUP_BUFFER_ADAPTIVE",
            "kind": "advisory",
            "confidence": "theoretical",
            "message": "HCCL 通信域当前使用统一 200 MiB Buffer；仅在显存偏满或 OOM 时评估自适应。",
            "fields": [
              "batch.sequence_length",
              "batch.micro_batch_size",
              "model.hidden_size",
              "parallel.tp",
              "parallel.cp",
              "parallel.ep",
              "features.hccl_group_buffer_adaptive"
            ],
            "applicable_hardware": [
              "昇腾 NPU"
            ],
            "applicable_versions": [
              "MindSpeed 0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
              "TorchNPU FrameworkPTAdapter >= 7.0.RC1.B020"
            ],
            "assumptions": [
              "Buffer 数值单位为 MiB，并按 MindSpeed 锁定版本中的自适应公式计算。",
              "未显式配置 MoE EP 负载不均衡系数；按 MindSpeed 默认行为将 EP 相关通信域保留为 200 MiB。",
              "该建议只描述静态配置方向，不代表性能收益已经通过 Profiling 校准。"
            ],
            "source": "mindspeed-rule",
            "source_ref": "MindSpeed:docs/zh/features/hccl-group-buffer-set.md@6563468; MindSpeed:mindspeed/core/hccl_buffer/hccl_adaptive_func.py:83-263@6563468",
            "data": {
              "unit": "MiB",
              "ep_load_imbalance_factor": null,
              "ep_factor_configured": false,
              "enabled": false,
              "groups": {
                "tp": 128,
                "pp": 64,
                "pp_new_stream": 64,
                "mp": 10,
                "mp_exp": 10,
                "tp_cp": 10,
                "exp": 200,
                "cp": 64
              },
              "action": "仅当理论容量偏满、实测显存紧张或发生 OOM 时，确认版本兼容后试加 --hccl-group-buffer-adaptive，并对比峰值显存与吞吐。",
              "impact_if_ignored": "配置和训练正确性不受影响；显存紧张时可能错失通信 Buffer 的节省空间。"
            }
          }
        ],
        "assumptions": [
          "只校验表单和 rule_profile 对应上游中已建模的静态约束，不代表目标环境已经实机运行通过。"
        ],
        "confidence": "deterministic",
        "data": {
          "valid": true,
          "world_size": 32,
          "ep_mode": "split",
          "pipeline_layer_mode": "uniform",
          "pipeline_stage_layers": null,
          "ep_domain": 4,
          "expert_data_parallel": 1
        },
        "quick_assessment": {
          "state": "passed",
          "conclusion": "配置通过已建模静态校验。",
          "evidence": [],
          "next_step": "如需确认可运行性，在目标环境继续验证。",
          "limitation": "静态通过不代表实机训练通过。"
        }
      },
      "stages": [
        {
          "stage": 0,
          "layers": 8,
          "parameter_count_on_card": 1783889920,
          "trainable_parameter_count_on_card": 1783889920,
          "capacity_gib": 64,
          "total_gib": 46.7913330078125,
          "ratio": 0.7311145782470703,
          "level": "safe",
          "inflight_micro_batches": 4,
          "full_pipeline_inflight": 4,
          "micro_batch_count": 32,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.6455078125,
            "gradient": 6.6455078125,
            "optimizer": 9.51025390625,
            "activation": 17,
            "reserve": 4.9900634765625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.9900634765625,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 1,
          "layers": 8,
          "parameter_count_on_card": 1652817920,
          "trainable_parameter_count_on_card": 1652817920,
          "capacity_gib": 64,
          "total_gib": 41.0470947265625,
          "ratio": 0.641360855102539,
          "level": "safe",
          "inflight_micro_batches": 3,
          "full_pipeline_inflight": 3,
          "micro_batch_count": 32,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.1572265625,
            "gradient": 6.1572265625,
            "optimizer": 9.26611328125,
            "activation": 12.75,
            "reserve": 4.7165283203125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.7165283203125001,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 2,
          "layers": 8,
          "parameter_count_on_card": 1652817920,
          "trainable_parameter_count_on_card": 1652817920,
          "capacity_gib": 64,
          "total_gib": 36.5845947265625,
          "ratio": 0.5716342926025391,
          "level": "safe",
          "inflight_micro_batches": 2,
          "full_pipeline_inflight": 2,
          "micro_batch_count": 32,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.1572265625,
            "gradient": 6.1572265625,
            "optimizer": 9.26611328125,
            "activation": 8.5,
            "reserve": 4.5040283203125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.5040283203125,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 3,
          "layers": 8,
          "parameter_count_on_card": 1783889920,
          "trainable_parameter_count_on_card": 1783889920,
          "capacity_gib": 64,
          "total_gib": 33.4038330078125,
          "ratio": 0.5219348907470703,
          "level": "safe",
          "inflight_micro_batches": 1,
          "full_pipeline_inflight": 1,
          "micro_batch_count": 32,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.6455078125,
            "gradient": 6.6455078125,
            "optimizer": 9.51025390625,
            "activation": 4.25,
            "reserve": 4.3525634765625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.3525634765625,
            "fsdp_unshard": 0
          }
        }
      ],
      "capacityAssumptions": [
        "结果复现页面六段容量口径，属于理论估算，不是设备实测峰值。",
        "运行时底座、HCCL buffer、workspace、碎片率和 FSDP2 预取深度使用页面经验系数。",
        "80% 警戒线是未校准的保守策略：当前估算已含运行时预留，仍额外保留 20% 以覆盖静态估算误差；它不是框架 OOM 标准。"
      ],
      "capacityConfidence": "theoretical",
      "sourceVersions": {
        "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
        "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
        "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
        "config_core": "0.1.1"
      }
    },
    {
      "name": "fullRecompute",
      "input": {
        "schema_version": "1.0",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "model": {
          "id": "S1-synthetic-MoE-not-a-released-model",
          "total_layers": 32,
          "hidden_size": 4096,
          "num_attention_heads": 32,
          "num_key_value_heads": 8,
          "ffn_hidden_size": 11008,
          "expert_ffn_hidden_size": 5632,
          "vocab_size": 32000,
          "routed_experts": 8,
          "top_k": 2,
          "shared_experts": 1,
          "first_k_dense_layers": 0
        },
        "parallel": {
          "dp": 4,
          "pp": 4,
          "tp": 2,
          "cp": 1,
          "ep": 4,
          "vpp": 1,
          "pipeline_layer_mode": "uniform",
          "ep_mode": "split",
          "cp_mode": "ulysses",
          "sequence_parallel": true,
          "vocab_embedding_data_parallel": true,
          "expert_tensor_parallel": false
        },
        "cluster": {
          "total_ranks": 32,
          "ranks_per_node": 8,
          "card_model": "synthetic NPU 64 GiB profile",
          "card_memory_gib": 64
        },
        "batch": {
          "micro_batch_size": 2,
          "sequence_length": 16384,
          "micro_batch_count": 16,
          "global_batch_size": 128
        },
        "memory": {
          "compute_dtype": "bf16",
          "parameter_dtype": "fp32",
          "recompute_mode": "full",
          "shard_mode": "zero1",
          "lora_enabled": false
        },
        "policy": {
          "locked_fields": [],
          "objective": "minimal-change"
        }
      },
      "validation": {
        "schema_version": "1.0",
        "tool": "validate_parallel_config",
        "status": "valid",
        "rule_profile": {
          "framework": "mindspeed-core",
          "version": "0.12.1",
          "source_commit": "65634689bed75ee9b6df666d526f7f16051a3db5"
        },
        "source_versions": {
          "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
          "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
          "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
          "config_core": "0.1.1"
        },
        "errors": [],
        "warnings": [],
        "suggestions": [
          {
            "code": "MINDSPEED_HCCL_GROUP_BUFFER_ADAPTIVE",
            "kind": "advisory",
            "confidence": "theoretical",
            "message": "HCCL 通信域当前使用统一 200 MiB Buffer；仅在显存偏满或 OOM 时评估自适应。",
            "fields": [
              "batch.sequence_length",
              "batch.micro_batch_size",
              "model.hidden_size",
              "parallel.tp",
              "parallel.cp",
              "parallel.ep",
              "features.hccl_group_buffer_adaptive"
            ],
            "applicable_hardware": [
              "昇腾 NPU"
            ],
            "applicable_versions": [
              "MindSpeed 0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
              "TorchNPU FrameworkPTAdapter >= 7.0.RC1.B020"
            ],
            "assumptions": [
              "Buffer 数值单位为 MiB，并按 MindSpeed 锁定版本中的自适应公式计算。",
              "未显式配置 MoE EP 负载不均衡系数；按 MindSpeed 默认行为将 EP 相关通信域保留为 200 MiB。",
              "该建议只描述静态配置方向，不代表性能收益已经通过 Profiling 校准。"
            ],
            "source": "mindspeed-rule",
            "source_ref": "MindSpeed:docs/zh/features/hccl-group-buffer-set.md@6563468; MindSpeed:mindspeed/core/hccl_buffer/hccl_adaptive_func.py:83-263@6563468",
            "data": {
              "unit": "MiB",
              "ep_load_imbalance_factor": null,
              "ep_factor_configured": false,
              "enabled": false,
              "groups": {
                "tp": 256,
                "pp": 128,
                "pp_new_stream": 128,
                "mp": 10,
                "mp_exp": 10,
                "tp_cp": 10,
                "exp": 200,
                "cp": 128
              },
              "action": "仅当理论容量偏满、实测显存紧张或发生 OOM 时，确认版本兼容后试加 --hccl-group-buffer-adaptive，并对比峰值显存与吞吐。",
              "impact_if_ignored": "配置和训练正确性不受影响；显存紧张时可能错失通信 Buffer 的节省空间。"
            }
          }
        ],
        "assumptions": [
          "只校验表单和 rule_profile 对应上游中已建模的静态约束，不代表目标环境已经实机运行通过。"
        ],
        "confidence": "deterministic",
        "data": {
          "valid": true,
          "world_size": 32,
          "ep_mode": "split",
          "pipeline_layer_mode": "uniform",
          "pipeline_stage_layers": null,
          "ep_domain": 4,
          "expert_data_parallel": 1
        },
        "quick_assessment": {
          "state": "passed",
          "conclusion": "配置通过已建模静态校验。",
          "evidence": [],
          "next_step": "如需确认可运行性，在目标环境继续验证。",
          "limitation": "静态通过不代表实机训练通过。"
        }
      },
      "stages": [
        {
          "stage": 0,
          "layers": 8,
          "parameter_count_on_card": 1783889920,
          "trainable_parameter_count_on_card": 1783889920,
          "capacity_gib": 64,
          "total_gib": 33.1413330078125,
          "ratio": 0.5178333282470703,
          "level": "safe",
          "inflight_micro_batches": 4,
          "full_pipeline_inflight": 4,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.6455078125,
            "gradient": 6.6455078125,
            "optimizer": 9.51025390625,
            "activation": 4,
            "reserve": 4.3400634765625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.3400634765625001,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 1,
          "layers": 8,
          "parameter_count_on_card": 1652817920,
          "trainable_parameter_count_on_card": 1652817920,
          "capacity_gib": 64,
          "total_gib": 30.8095947265625,
          "ratio": 0.4813999176025391,
          "level": "safe",
          "inflight_micro_batches": 3,
          "full_pipeline_inflight": 3,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.1572265625,
            "gradient": 6.1572265625,
            "optimizer": 9.26611328125,
            "activation": 3,
            "reserve": 4.2290283203125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.2290283203125,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 2,
          "layers": 8,
          "parameter_count_on_card": 1652817920,
          "trainable_parameter_count_on_card": 1652817920,
          "capacity_gib": 64,
          "total_gib": 29.7595947265625,
          "ratio": 0.4649936676025391,
          "level": "safe",
          "inflight_micro_batches": 2,
          "full_pipeline_inflight": 2,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.1572265625,
            "gradient": 6.1572265625,
            "optimizer": 9.26611328125,
            "activation": 2,
            "reserve": 4.1790283203125
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.1790283203125,
            "fsdp_unshard": 0
          }
        },
        {
          "stage": 3,
          "layers": 8,
          "parameter_count_on_card": 1783889920,
          "trainable_parameter_count_on_card": 1783889920,
          "capacity_gib": 64,
          "total_gib": 29.9913330078125,
          "ratio": 0.4686145782470703,
          "level": "safe",
          "inflight_micro_batches": 1,
          "full_pipeline_inflight": 1,
          "micro_batch_count": 16,
          "vpp_chunks": 1,
          "recomputed_layers": 0,
          "values_gib": {
            "base": 2,
            "weight": 6.6455078125,
            "gradient": 6.6455078125,
            "optimizer": 9.51025390625,
            "activation": 1,
            "reserve": 4.1900634765625
          },
          "reserve_parts_gib": {
            "communication": 2,
            "workspace": 1,
            "fragmentation": 1.1900634765625,
            "fsdp_unshard": 0
          }
        }
      ],
      "capacityAssumptions": [
        "结果复现页面六段容量口径，属于理论估算，不是设备实测峰值。",
        "运行时底座、HCCL buffer、workspace、碎片率和 FSDP2 预取深度使用页面经验系数。",
        "80% 警戒线是未校准的保守策略：当前估算已含运行时预留，仍额外保留 20% 以覆盖静态估算误差；它不是框架 OOM 标准。"
      ],
      "capacityConfidence": "theoretical",
      "sourceVersions": {
        "tool_matrix_ui": "1e6bb6eabe60f75b2486188b3b08b59f65d33621",
        "plane_ui_reference": "485d5206ce4c0cd4719f5d28dd5cbbeb04680be1",
        "mindspeed_core": "0.12.1@65634689bed75ee9b6df666d526f7f16051a3db5",
        "config_core": "0.1.1"
      }
    }
  ]
};
