# moviepilot

MoviePilot 影视订阅与管理工具。

## 功能

通过 MoviePilot API 搜索、订阅和管理电影/电视剧，支持自动下载。

## 适用场景

- 搜索电影或电视剧
- 订阅影视资源，实现自动下载
- 查看和管理现有订阅
- 取消订阅
- 查看下载状态
- 浏览推荐内容（豆瓣/TMDB/Bangumi）

## 前置条件

需要设置以下环境变量：

| 变量 | 说明 |
|------|------|
| `MOVIEPILOT_URL` | MoviePilot 服务地址，如 `http://127.0.0.1:3000` |
| `MOVIEPILOT_API_KEY` | API Key 认证（推荐） |
| `MOVIEPILOT_TOKEN` | Bearer Token（通过登录获取，备选） |

## 核心操作

| 操作 | 命令示例 |
|------|----------|
| 搜索影视 | `scripts/moviepilot_api.sh search "流浪地球"` |
| 添加订阅 | `scripts/moviepilot_api.sh sub_add '{"name":"...","type":"电影","tmdbid":123}'` |
| 查看订阅 | `scripts/moviepilot_api.sh sub_list` |
| 删除订阅 | `scripts/moviepilot_api.sh sub_delete <id>` |
| 查看下载 | `scripts/moviepilot_api.sh downloads` |
| 浏览推荐 | `scripts/moviepilot_api.sh recommend douban_movie_hot` |
| 搜索种子 | `scripts/moviepilot_api.sh search_resource "keyword"` |

## 注意事项

- 媒体 ID 使用前缀格式：`tmdb:12345`、`douban:12345`、`bangumi:12345`
- 订阅前务必先搜索以获取正确的媒体 ID
- `type` 字段使用中文：`"电影"` 或 `"电视剧"`

## 文件结构

```
moviepilot/
├── SKILL.md                        # Skill 定义（英文）
├── README.md                       # 说明文档（本文件）
├── references/
│   └── api_reference.md            # API 接口文档
└── scripts/
    └── moviepilot_api.sh           # API 调用脚本
```

## 安装

将本目录复制到 `~/.claude/skills/` 下即可：

```bash
cp -r moviepilot ~/.claude/skills/
```
