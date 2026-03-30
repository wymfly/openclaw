# Seed Layer — 预置配置种子

本目录包含部署时自动注入的预配置数据。

## 目录结构

```
seed/
├── openclaw.json.tmpl      # 主配置模板（envsubst 渲染）
├── agents/                  # 预置 agent 定义
│   └── main/                # 主 agent
├── cron/                    # 预置定时任务
│   └── jobs.json
├── extensions/              # 预置插件（运行时安装的）
│   └── <plugin-name>/       # 如 openclaw-weixin/
├── skills/                  # 自定义 skills
│   └── <skill-name>/        # 如 custom-tool/
├── plugins-config.json      # 插件启用配置（合并到 openclaw.json）
└── README.md                # 本文件
```

## 种子策略

| 策略 | 行为 | 适用内容 |
|------|------|----------|
| init-once | 仅首次部署写入，用户修改后不覆盖 | openclaw.json, agents/, cron/, extensions/ |
| always-sync | 每次升级覆盖 | skills/（自定义 skills 始终保持最新） |
| never-seed | 运行时生成 | devices/, logs/, sessions/, deck.db |

## 定制方式

### 手动添加

1. 编辑 `openclaw.json.tmpl` 添加/修改 provider 和 model
2. 在 `agents/` 下新建目录添加预置 agent
3. 编辑 `cron/jobs.json` 添加预置定时任务
4. 在 `extensions/` 下放入插件目录
5. 在 `skills/` 下放入自定义 skill 目录
6. 运行 `../scripts/setup.sh` 重新部署

### 从本机自动收集

```bash
# 打包时加 --with-local 自动从 ~/.openclaw 收集
deploy/scripts/package.sh --with-local
```

这会自动收集：
- `~/.openclaw/extensions/` 下的运行时插件
- `~/.openclaw/skills/` 下的自定义 skills
- `openclaw.json` 中的 plugins 配置段

## 模板变量

`openclaw.json.tmpl` 中的 `${VAR_NAME}` 占位符在部署时由 `.env` 文件中的值替换。
使用 `${VAR:-default}` 语法设置默认值。
