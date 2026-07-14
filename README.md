# NBA Salary Value Explorer

纯静态 NBA 球员薪资价值可视化网站。页面直接读取本地 JSON，不使用 Shiny、数据库、后端 API、登录或 SSR。

## 数据来源

- 网站源数据：`D:\nba\salary_scatter_web.json`
- 原始头像：`D:\nba\headshot`
- Logo 来源：`D:\nba\www\sr_logo_nav_white.png`

本项目不会修改或覆盖上述原始文件。

## 数据处理方式

`scripts\prepare_site_data.py` 会读取源 JSON，检查 `player_id`，调用头像转换脚本，并仅保留成功转换出 WebP 头像的球员。生成的网站数据位于：

- `data\salary_scatter_web.json`
- `data\metadata.json`
- `excluded_players.csv`
- `headshot_conversion_report.csv`

网站 JSON 中的 `headshot_file` 统一写为 `assets/headshots/{player_id}.webp`。

## 头像转换方式

`scripts\convert_headshots.py` 使用 Pillow 将 `D:\nba\headshot\{player_id}.png` 转换为 WebP：

- 输出母目录：`D:\nba\headshot(webp)`
- 网站头像目录：`assets\headshots`
- WebP quality：85
- 保留透明通道
- 不放大、不裁切、不增加背景
- 已转换且源文件未更新的头像会跳过重复转换

## 本地运行

在项目目录运行：

```powershell
py -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

不要通过双击 `index.html` 测试，因为浏览器对本地文件读取 JSON 有限制。

## 更新数据步骤

1. 更新 `D:\nba\salary_scatter_web.json`
2. 更新或补充 `D:\nba\headshot` 中的 PNG 头像
3. 运行：

```powershell
py "D:\nba\salary_scatter_site\scripts\prepare_site_data.py"
```

4. 重新启动或刷新本地页面
5. 验证筛选、搜索、图表轴切换、Tooltip 和表格联动
6. 后续再执行 GitHub 推送和 EdgeOne Makers 部署

## 目录说明

```text
salary_scatter_site
├─ index.html
├─ assets
│  ├─ brand
│  ├─ css
│  ├─ headshots
│  ├─ js
│  └─ vendor
├─ data
├─ scripts
├─ README.md
└─ .gitignore
```

## GitHub 部署准备

该项目是无构建静态站点，可直接将 `salary_scatter_site` 目录作为仓库根目录提交。确认：

- 所有路径均为相对路径
- `data\salary_scatter_web.json` 已更新
- `assets\headshots` 已包含所需 WebP
- `assets\vendor` 已包含 ECharts 和 Tabulator 本地文件

## EdgeOne Makers 部署准备

后续可将 GitHub 仓库接入 EdgeOne Makers，静态根目录使用仓库根目录。无需环境变量、后端 API 或数据库。

## 当前已知限制

- 数据模型估值仅用于可视化和比较，不代表真实交易价值或正式薪资建议。
- 无头像或头像转换失败的球员不会展示。
- 球队信息以源 JSON 为准，不在前端推断交易或自由市场变化。
- 普通散点默认使用圆点；仅在搜索、选中或少量球员筛选时突出头像，以避免一次加载大量图片。
