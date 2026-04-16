# 暴力破解攻击分析报告

**服务器**: 60.204.148.217 (Windows Server 2016, 主机名: MES)  
**分析时间**: 2026-04-15 13:57 UTC+8  
**数据窗口**: 2026-04-14 13:52 ~ 2026-04-15 13:52（24小时）

---

## 1. 概况

| 指标           | 数值                     |
| -------------- | ------------------------ |
| 失败登录总数   | **11,668 次**            |
| 攻击持续时间   | 24 小时不间断            |
| 平均频率       | ~486 次/小时（~7 秒/次） |
| 攻击来源 IP 数 | 至少 8 个独立 IP         |
| 攻击目标端口   | RDP (3389) + SSH (22)    |

## 2. 攻击来源 IP 分析

| 排名 | IP                | 次数  | 特征                                                                           |
| ---- | ----------------- | ----- | ------------------------------------------------------------------------------ |
| 1    | 122.227.181.22    | 4,275 | 纯 RDP 暴力破解，仅尝试 `administrator`，18-20s 固定间隔                       |
| 2    | （SSH 无记录 IP） | 4,144 | SSH 暴力破解，用户名包含 `NOUSER`、字典用户名                                  |
| 3    | 80.66.66.51       | 1,321 | RDP 字典攻击，尝试 `administrator` + 变体（`administrator2/3`、`ismarter1/7`） |
| 4    | 223.106.5.110     | 867   | RDP 暴力破解                                                                   |
| 5    | 220.248.17.11     | 570   | RDP 暴力破解                                                                   |
| 6    | 121.10.195.58     | 369   | RDP 暴力破解                                                                   |
| 7    | 221.226.5.38      | 59    | RDP 暴力破解                                                                   |
| 8    | 80.66.83.80       | 48    | RDP 暴力破解，与 #3 同 C 段（80.66.x.x）                                       |
| —    | 10.8.113.22       | 6     | **合法用户**（内网）                                                           |
| —    | 36.153.225.50     | 6     | **合法用户**（外网）                                                           |

## 3. 目标用户名分析

| 用户名             | 次数  | 判定                                    |
| ------------------ | ----- | --------------------------------------- |
| administrator      | 6,218 | 主目标，所有攻击 IP 均尝试              |
| NOUSER             | 3,355 | SSH 探测（无效用户名）                  |
| 默认用户账户       | 316   | Windows 默认账户探测                    |
| \\\\               | 313   | 格式畸形探测                            |
| DefaultAccount     | 221   | Windows 10/Server 2016 默认账户         |
| WDAGUtilityAccount | 220   | Windows Defender Application Guard 账户 |
| Admin              | 172   | 常见管理员别名                          |
| RASCOM             | 95    | 远程访问服务账户                        |
| RAS_admin          | 95    | 远程访问服务管理账户                    |
| FakeUser           | 56    | 扫描探测用户名                          |

## 4. 攻击判定依据

1. **自动化特征**: 122.227.181.22 以 18-20 秒固定间隔持续 24 小时，非人工操作
2. **字典攻击特征**: 80.66.66.51 使用 `administrator2/3`、`ismarter1/7` 等变体用户名
3. **多源协同**: 至少 8 个不同 IP 同时攻击，覆盖 RDP + SSH 两个端口
4. **已知恶意 IP**: `80.66.66.x` 段是已知东欧攻击基础设施
5. **非法用户名**: `Dewittuser`、`RASCOM`、`FakeUser` 等不存在于本系统

**结论**: 确认为自动化暴力破解攻击，非合法登录重试。

## 5. 当前安全配置缺陷

| 问题                   | 当前值                  | 风险                   |
| ---------------------- | ----------------------- | ---------------------- |
| 账户锁定阈值           | **永不**（未启用）      | 攻击者可无限尝试密码   |
| Administrator 密码年龄 | 3 年（2023-04-14 设置） | 长期未更换，泄露风险高 |
| RDP 端口               | 默认 3389               | 全网扫描首要目标       |
| SSH 端口               | 默认 22                 | 全网扫描首要目标       |
| 防火墙 IP 白名单       | 未配置                  | 任意 IP 可访问管理端口 |
| RDS 授权               | 过期                    | 导致 RDP 无法正常连接  |

---

## 6. 解决方案

### 6.1 紧急处理（立即执行）

#### A. 防火墙封禁攻击 IP

```powershell
# 封禁 Top 5 攻击源 IP
$attackIPs = @(
    "122.227.181.22",
    "80.66.66.51",
    "223.106.5.110",
    "220.248.17.11",
    "121.10.195.58",
    "221.226.5.38",
    "80.66.83.80"
)

New-NetFirewallRule -DisplayName "Block Brute Force IPs" `
    -Direction Inbound `
    -Action Block `
    -RemoteAddress $attackIPs `
    -Profile Any `
    -Enabled True
```

#### B. 限制 RDP/SSH 访问源 IP

```powershell
# 仅允许特定 IP 段访问 RDP
New-NetFirewallRule -DisplayName "Allow RDP Trusted Only" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3389 `
    -Action Allow `
    -RemoteAddress @("10.8.0.0/16", "36.153.225.0/24") `
    -Profile Any

# 阻止其他所有 RDP 访问
New-NetFirewallRule -DisplayName "Block RDP Others" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3389 `
    -Action Block `
    -Profile Any

# SSH 同理
New-NetFirewallRule -DisplayName "Allow SSH Trusted Only" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 22 `
    -Action Allow `
    -RemoteAddress @("10.8.0.0/16", "36.153.225.0/24") `
    -Profile Any

New-NetFirewallRule -DisplayName "Block SSH Others" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 22 `
    -Action Block `
    -Profile Any
```

> **注意**: 上述 IP 段需根据实际管理 IP 调整，确保不会锁死自己。

#### C. 启用账户锁定策略

```powershell
# 5 次失败后锁定 30 分钟
net accounts /lockoutthreshold:5
net accounts /lockoutduration:30
net accounts /lockoutwindow:30
```

#### D. 修复 RDP 授权（需重启）

```powershell
# 已执行：LicensingMode 改为 2（远程管理模式）
# 需要完整重启服务器生效
Restart-Computer -Force
```

### 6.2 短期加固（1 周内）

| 措施                    | 说明                                                   |
| ----------------------- | ------------------------------------------------------ |
| 更换 Administrator 密码 | 当前密码已使用 3 年，建议 16+ 字符强密码               |
| 修改 RDP 默认端口       | 3389 → 非标准端口（如 13389），减少扫描暴露            |
| 修改 SSH 默认端口       | 22 → 非标准端口（如 10022）                            |
| 禁用不需要的账户        | `DefaultAccount`、`WDAGUtilityAccount` 等              |
| 启用 NLA                | Network Level Authentication 要求先认证再建立 RDP 会话 |

### 6.3 长期建议

| 措施                 | 说明                                                     |
| -------------------- | -------------------------------------------------------- |
| 部署 fail2ban 类工具 | 自动封禁多次失败的 IP（Windows 可用 RdpGuard、IPBan 等） |
| VPN 接入             | 管理端口不直接暴露公网，通过 VPN 隧道访问                |
| 定期审计             | 定期检查安全日志，关注异常登录模式                       |
| Windows Update       | 保持系统安全补丁更新                                     |

---

## 7. 执行优先级

| 优先级 | 操作                    | 预计影响             |
| ------ | ----------------------- | -------------------- |
| P0     | 防火墙封禁攻击 IP       | 立即阻断当前攻击     |
| P0     | 启用账户锁定策略        | 限制后续暴力破解效率 |
| P0     | 重启服务器              | 修复 RDP 授权问题    |
| P1     | 限制 RDP/SSH 访问源 IP  | 从根本上减少攻击面   |
| P1     | 更换 Administrator 密码 | 消除密码泄露风险     |
| P2     | 修改默认端口            | 减少自动化扫描发现   |
| P2     | 部署自动封禁工具        | 持续防护             |
