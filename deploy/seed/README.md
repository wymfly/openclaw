# Seed Layer — 预置配置种子

本目录包含部署时自动注入的预配置数据。

## 目录结构

```
seed/
├── openclaw.json.tmpl   # 主配置模板（envsubst 渲染）
├── agents/              # 预置 agent 定义
│   └── main/            # 主 agent
├── cron/                # 预置定时任务
│   └── jobs.json
└── README.md            # 本文件
```

## 种子策略

| 策略        | 行为                             | 适用内容                            |
| ----------- | -------------------------------- | ----------------------------------- |
| init-once   | 仅首次部署写入，用户修改后不覆盖 | openclaw.json, agents/, cron/       |
| always-sync | 每次升级覆盖                     | skills/, extensions/                |
| never-seed  | 运行时生成                       | devices/, logs/, sessions/, deck.db |

## 定制方式

1. 编辑 `openclaw.json.tmpl` 添加/修改 provider 和 model
2. 在 `agents/` 下新建目录添加预置 agent
3. 编辑 `cron/jobs.json` 添加预置定时任务
4. 运行 `../scripts/setup.sh` 重新部署

## 模板变量

`openclaw.json.tmpl` 中的 `${VAR_NAME}` 占位符在部署时由 `.env` 文件中的值替换。
使用 `${VAR:-default}` 语法设置默认值。
