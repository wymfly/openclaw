# 当前部署状态

这份文档记录当前正在使用的 legacy OpenClaw + Deck Windows 部署快照。

最后验证时间：`2026-05-14`

## 服务器

| 项目            | 当前值                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| 主机            | `60.204.148.217`                                                                                |
| 运维用户        | `Administrator`                                                                                 |
| 工作根目录      | `D:\openclaw`                                                                                   |
| 当前应用根目录  | `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911`                              |
| 源码/运行时目录 | `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\source`                       |
| 持久化数据目录  | `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\data`                         |
| OpenClaw 配置   | `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\data\.openclaw\openclaw.json` |
| 日志目录        | `D:\openclaw\selftest-data-verify\openclaw-deploy-20260413-174911\data\logs`                    |
| 发布资产目录    | `D:\openclaw\publish\final-taskfix3`                                                            |

## 正在运行的服务

| 服务                   | 运行入口                                                                               | 当前状态 | 监听地址                       | 作用                                  |
| ---------------------- | -------------------------------------------------------------------------------------- | -------- | ------------------------------ | ------------------------------------- |
| Windows Scheduled Task | `OpenClaw Deploy Current`                                                              | 运行中   | n/a                            | 管理当前部署的 Gateway 和 Deck 进程树 |
| Gateway                | `node.exe` 运行 `source\openclaw.mjs gateway run --bind loopback --port 19040 --force` | 健康     | `127.0.0.1:19040`, `::1:19040` | OpenClaw 核心 Gateway 和插件运行时    |
| Deck / Dashboard       | `node.exe` 运行 `.next/standalone/dashboard/standalone-entry.mjs`                      | 健康     | `0.0.0.0:3340`                 | 对外 Web UI 和 Gateway BFF 代理       |

WeCom、email、browser、ACP 等插件能力都运行在 Gateway 进程内，不是单独的 Windows 服务。

## 当前未运行的组件

| 组件               | 预期目录/端口                                   | 当前状态 | 说明                                                                                                 |
| ------------------ | ----------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| 发布静态 HTTP 服务 | `D:\openclaw\publish\final-taskfix3` 的 `:8088` | 未监听   | 发布目录存在，但当前没有进程监听 `8088`；公网探测返回 `502`。只有需要提供安装/更新资产时才需要启动。 |

## 对外端口

| 端口    | 暴露方式        | 当前结果           | 说明                                                                 |
| ------- | --------------- | ------------------ | -------------------------------------------------------------------- |
| `22`    | 公网 SSH        | 可连接             | 服务器运维入口                                                       |
| `3340`  | 公网 HTTP       | `200`              | Deck 主入口；浏览器访问和公网健康检查都走这里                        |
| `19040` | 仅本机 loopback | 公网直连返回 `502` | Gateway 故意绑定到 loopback；公网访问应通过 Deck/BFF 或 SSH 本机探测 |
| `8088`  | 预留发布 HTTP   | 公网探测返回 `502` | 当前未运行；不要假设 install bootstrap 资产现在可从公网获取          |

## 公网端点

| 端点                                                    | 当前结果 | 用途                                  |
| ------------------------------------------------------- | -------- | ------------------------------------- |
| `http://60.204.148.217:3340/`                           | `200`    | Deck UI                               |
| `http://60.204.148.217:3340/api/gateway/health`         | `200`    | 通过 Deck/BFF 暴露的 Gateway 健康检查 |
| `http://60.204.148.217:3340/api/channels`               | `200`    | 通过 Deck/BFF 暴露的渠道/插件状态     |
| `http://60.204.148.217:8088/final-taskfix3/install.ps1` | `502`    | 发布 bootstrap；当前未运行            |
| `http://60.204.148.217:19040/healthz`                   | `502`    | Gateway 公网直连；按当前设计不可用    |

## 本机健康检查

在目标服务器上执行：

```powershell
Invoke-RestMethod -UseBasicParsing http://127.0.0.1:19040/healthz
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3340/api/gateway/health
Get-ScheduledTask -TaskName 'OpenClaw Deploy Current'
Get-NetTCPConnection -State Listen | ? { $_.LocalPort -in 3340,19040,8088 }
```

当前预期结果：

- Gateway health 返回 `{"ok":true,"status":"live"}`。
- Deck Gateway health 端点返回 HTTP `200`。
- Windows 计划任务 `OpenClaw Deploy Current` 为 `Running`。
- `3340` 和 loopback `19040` 有监听；`8088` 当前没有监听。

## 运维备注

- `deploy/STATUS.md` 记录完整部署历史。
- 本文件用于快速交接当前真实状态。
- `deploy/` 是 legacy Deck/dashboard 部署链路；新的 `deck-go/` 部署规划是独立事项，不复用本目录。
- 如果后续需要重新通过 `8088` 提供安装/更新资产，需要先启动发布 HTTP 服务，验证后同步更新本文件和 `deploy/STATUS.md`。
