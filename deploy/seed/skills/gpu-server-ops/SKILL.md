---
name: gpu-server-ops
description: >
  Remote GPU server operations skill for deploying AI models, managing services,
  and maintaining infrastructure on a WSL2 GPU server (RTX 5090).
  Use this skill whenever the user mentions deploying models to a server, managing
  GPU services, checking server status, starting/stopping remote services, setting up
  conda/docker environments on a remote machine, compiling CUDA extensions, or any task
  involving the GPU workstation at 100.84.132.54. Also trigger when user says "部署到服务器",
  "启动/停止模型服务", "GPU服务器", "远程服务器", or references server-side operations.
---

# GPU Server Operations

远程 GPU 服务器的全面运维规范，涵盖连接、环境管理、服务部署、GPU 监控和项目状态管理。

---

## 服务器信息

| 属性       | 值                                                    |
| ---------- | ----------------------------------------------------- |
| 地址       | 100.84.132.54                                         |
| 用户       | wym                                                   |
| 密码       | 123456                                                |
| sudo       | 有，需要密码（同上）                                  |
| OS         | Ubuntu 22.04 WSL2                                     |
| GPU        | NVIDIA GeForce RTX 5090 (32GB VRAM, Blackwell sm_120) |
| CPU        | AMD Ryzen 9 9950X3D                                   |
| 磁盘       | ~1TB, 挂载 /dev/sdd                                   |
| conda      | ~/miniconda3                                          |
| nvidia-smi | /usr/lib/wsl/lib/nvidia-smi（WSL2 路径）              |

---

## 连接方式

始终使用 `sshpass` 连接，不依赖 SSH agent 或密钥：

```bash
# 单条命令
sshpass -p '123456' ssh -o StrictHostKeyChecking=no wym@100.84.132.54 "<command>"

# 上传文件
sshpass -p '123456' scp <local_file> wym@100.84.132.54:<remote_path>

# 下载文件
sshpass -p '123456' scp wym@100.84.132.54:<remote_path> <local_path>

# sudo 操作
sshpass -p '123456' ssh wym@100.84.132.54 "echo '123456' | sudo -S <command>"
```

对于多条依赖命令，用 `&&` 串联或写成脚本上传执行。避免交互式命令（如 `vi`、`ssh-keygen` 交互模式）。

---

## 安全规范

### 工作空间隔离

- **所有操作限制在 `~/workspace/` 目录下**，用户每次会指定具体的子目录
- `~/workspace/` 下可按需创建子目录（如 `models/`、`services/`、`temp/`）
- 临时文件用 `~/workspace/temp/` 或 `/tmp/`
- **禁止**在 `~/workspace/` 以外写入业务文件（系统配置和 conda 环境除外）

### 操作安全

- 执行破坏性操作（rm -rf、pkill、conda remove）前必须确认
- 大文件下载前检查磁盘空间：`df -h /home/wym`
- 端口分配前检查冲突：`lsof -i:<port>` 或 `ss -tlnp | grep <port>`
- 长时间运行的进程使用 `nohup ... &` 并记录 PID 和日志路径

### GPU 资源

- 启动新模型前检查 GPU 显存占用：`/usr/lib/wsl/lib/nvidia-smi`
- RTX 5090 共 32GB VRAM，需预估新服务的显存需求
- 多模型共存时注意总显存不超限

---

## 环境管理

### Conda 环境

```bash
# 基本操作
export PATH=$HOME/miniconda3/bin:$PATH
source activate <env_name>      # 激活环境
conda env list                  # 列出所有环境
conda create -n <name> python=3.10  # 创建新环境

# 在 SSH 命令中使用
sshpass -p '123456' ssh wym@100.84.132.54 "export PATH=\$HOME/miniconda3/bin:\$PATH && source activate <env> && <command>"
```

### 环境隔离原则

- **每个独立项目/模型使用独立的 conda 环境**，不共享
- 新建环境时推荐 Python 3.10（兼容性最好）
- Docker 可用于更强的隔离需求
- 环境命名与项目名一致，小写短横线（如 `hunyuan3d`、`triposg`）

### RTX 5090 (Blackwell) 特殊要求

RTX 5090 是 Blackwell 架构（sm_120, compute capability 12.0），有以下已知兼容性问题：

1. **xformers 不兼容**：xformers 最高支持 sm_90，RTX 5090 必须使用替代方案
   - 设置 `XFORMERS_DISABLED=1` 禁用
   - 使用 PyTorch 原生 SDPA（Scaled Dot Product Attention）替代
   - 环境变量：`ATTN_BACKEND=sdpa`

2. **PyTorch 版本要求**：必须用 cu128 或更高版本

   ```bash
   pip install torch --index-url https://download.pytorch.org/whl/cu128
   ```

3. **CUDA 编译**：编译自定义 CUDA 扩展时必须设置

   ```bash
   export TORCH_CUDA_ARCH_LIST='8.0;9.0;10.0;12.0'
   export CUDA_HOME=$CONDA_PREFIX  # 使用 conda 的 cuda-toolkit
   ```

4. **libstdc++ 兼容**：系统 libstdc++ 可能过旧，优先使用 conda 的版本
   ```bash
   export LD_LIBRARY_PATH=$CONDA_PREFIX/lib:$LD_LIBRARY_PATH
   ```
   如果遇到 `CXXABI_1.3.15 not found`，先安装：
   ```bash
   conda install -c conda-forge libstdcxx-ng
   ```

---

## 服务部署规范

### 标准 API 服务结构

每个服务应包含：

- `api_server.py` — FastAPI 入口（统一模式）
- 启动脚本 `start_<service>.sh`
- 日志输出到固定位置

### 启动脚本模板

```bash
#!/bin/bash
export PATH=$HOME/miniconda3/bin:$PATH
source activate <env_name>
export LD_LIBRARY_PATH=$CONDA_PREFIX/lib:$LD_LIBRARY_PATH
cd ~/workspace/<project_dir>

if lsof -i:<port> -t > /dev/null 2>&1; then
    echo "<service> already running on port <port>"
    exit 0
fi

echo "Starting <service> on port <port>..."
nohup python api_server.py --host 0.0.0.0 --port <port> > <log_path> 2>&1 &
echo "PID: $!"
echo "Log: <log_path>"
```

### API 服务模板

FastAPI 服务至少需要：

- `GET /health` — 健康检查（返回服务名、状态、GPU 信息）
- `POST /generate` 或其他业务端点
- CORS 中间件（`allow_origins=["*"]`）
- 合理的超时和错误处理

### 常用运维命令

```bash
# 查看 GPU 状态
/usr/lib/wsl/lib/nvidia-smi

# 查看所有 Python 服务
ps aux | grep python | grep -v grep

# 查看端口占用
ss -tlnp | grep LISTEN

# 查看特定服务日志
tail -50 ~/workspace/<project>/xxx.log

# 停止特定端口服务
kill $(lsof -i:<port> -t)
```

---

## 项目状态管理

### README 规范

每个项目工作目录下必须维护 `README.md`（如果不存在则创建），内容规范如下：

```markdown
# <项目名称>

> <一句话描述>

## 部署状态

| 服务           | 端口   | 环境        | 状态     | 备注    |
| -------------- | ------ | ----------- | -------- | ------- |
| <service_name> | <port> | <conda_env> | ✅/❌/⏳ | <notes> |

## 目录结构

<关键文件和目录说明>

## 启动方式

<启动命令或脚本路径>

## 已知问题

<当前存在的问题和临时解决方案>

## 变更记录

| 日期       | 变更内容       | 操作者      |
| ---------- | -------------- | ----------- |
| YYYY-MM-DD | <what changed> | Claude/User |
```

### README 更新时机

- **新服务部署后** — 添加服务信息到部署状态表
- **修复问题后** — 更新已知问题、添加变更记录
- **环境变更后** — 更新启动方式或依赖说明
- **每次会话结束时** — 确保 README 反映最新状态

### 更新原则

- 增量更新，不要覆盖整个文件
- 变更记录按时间倒序（最新在前）
- 状态标记：✅ 正常运行 / ❌ 故障 / ⏳ 部署中 / 🔧 需维护

---

## 故障排查流程

遇到服务启动失败或运行异常时，按以下顺序排查：

1. **查看日志**：`tail -100 <log_path>` 找到具体错误
2. **检查 GPU**：`/usr/lib/wsl/lib/nvidia-smi` 确认显存和进程
3. **检查端口**：`ss -tlnp | grep <port>` 确认端口未被占用
4. **检查环境**：`conda activate <env> && python -c "import torch; print(torch.cuda.is_available())"` 确认 CUDA 可用
5. **检查依赖**：`pip list | grep <package>` 确认关键依赖已安装
6. **检查 libstdc++**：如果报 CXXABI 错误，确认 `LD_LIBRARY_PATH` 包含 conda lib

### 常见问题速查

| 错误                      | 原因                           | 解决                                                        |
| ------------------------- | ------------------------------ | ----------------------------------------------------------- |
| `CXXABI_1.3.15 not found` | 系统 libstdc++ 过旧            | `export LD_LIBRARY_PATH=$CONDA_PREFIX/lib:$LD_LIBRARY_PATH` |
| `Unknown CUDA arch`       | CUDA arch 未设置               | `export TORCH_CUDA_ARCH_LIST='8.0;9.0;10.0;12.0'`           |
| `xformers` 相关错误       | RTX 5090 不支持                | `export XFORMERS_DISABLED=1` + 使用 sdpa 后端               |
| `CUDA version mismatch`   | 系统 CUDA 与 PyTorch 不匹配    | `conda install -c nvidia cuda-toolkit=12.8`                 |
| `GatedRepoError`          | HuggingFace 模型需要权限       | `huggingface-cli login --token <token>`                     |
| `No module named xxx`     | 依赖未安装或 PYTHONPATH 未设置 | 检查 pip list 或 export PYTHONPATH                          |

---

## 工作流程

当用户激活此 skill 并指定工作目录和任务时：

1. **连接确认**：用 `sshpass` 连接服务器，快速检查连通性和 GPU 状态
2. **读取项目状态**：读取指定目录下的 `README.md`（如果存在）了解当前状态
3. **执行任务**：按照上述规范执行部署/运维操作
4. **更新状态**：任务完成后更新 `README.md` 的部署状态和变更记录
5. **确认结果**：向用户报告操作结果和当前服务状态
