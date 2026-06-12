# Project Index

最近更新时间：2026-06-12

## 项目简介

这是一个舒尔特方格/专注力训练 Web 应用。用户可在浏览器中完成多种训练，记录成绩，登录后同步用户资料、每日任务和训练记录；管理员可管理用户、重置密码、删除用户并配置时区。应用还提供 `/u/:identifier` 公开成绩页和 `/health` 健康检查。

备注：当前仓库中的部分中文文本在若干源码/README 输出中呈现乱码，索引根据代码结构、可读 HTML 片段和接口命名整理。

## 技术栈

- Runtime：Node.js
- Web 框架：Express 4
- 前端：原生 HTML/CSS/JavaScript，主要集中在 `public/index.html`
- 数据库：`sql.js`，以 SQLite 文件形式落盘
- 安全/中间件：`cors`、`compression`、`express-rate-limit`、PBKDF2 + SHA-256 密码哈希、会话 token hash
- 配置：`.env` / 环境变量
- 部署：Docker、Docker Compose，默认端口 `3000`

## 主要目录

- `src/index.js`：服务入口，Express 中间件、页面路由、公开页、健康检查、启动初始化。
- `src/routes.js`：JSON API 路由，包括用户、成绩、每日任务、公开数据、设置、管理员接口。
- `src/db.js`：sql.js 初始化、表结构、用户/任务/成绩/设置 CRUD、数据库保存。
- `src/utils.js`：训练记录归一化、任务匹配、日期/时区、评分、密码/session、安全输出工具。
- `src/html.js`：主页 HTML 读取缓存和公开用户成绩页服务端渲染。
- `public/index.html`：单页前端，包含样式、训练模式、用户中心、每日任务、成绩、本地存储、后台管理 UI。
- `Dockerfile`：生产镜像构建。
- `docker-compose.yml`：容器运行配置、数据卷、健康检查、日志轮转。
- `.env.example`：环境变量示例。
- `docs/ai/`：AI 维护索引与变更记录。

## 常用命令

所有 shell 命令按本机规则优先加 `rtk` 前缀。

```bash
rtk npm install
rtk npm start
rtk npm run dev
rtk docker-compose up -d
rtk docker-compose down
```

最小验证建议：

```bash
rtk node --check src/index.js
rtk node --check src/routes.js
rtk node --check src/db.js
rtk node --check src/utils.js
rtk node --check src/html.js
```

如改动前端单页，优先启动本地服务后用浏览器冒烟验证：

```bash
rtk npm start
```

然后访问：

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/health`

## 环境变量

- `PORT`：服务端口，默认 `3000`。
- `ADMIN_PASSWORD`：管理员密码，用于后台管理接口。
- `USER_CREATE_CODE`：创建用户授权码。
- `DB_PATH`：SQLite 文件路径，默认 `data/schulte.db`，Docker 中为 `/app/data/schulte.db`。

## AI 维护入口说明

1. 每次任务先读本文件和 `docs/ai/FEATURE_INDEX.md`。
2. 根据用户请求定位功能单元。
3. 默认只读取该功能单元的 P0 文件；P1/P2 仅在需要理解跨功能影响、部署、数据迁移或历史背景时读取。
4. 修改完成后同步更新 `FEATURE_INDEX.md` 中对应功能单元的文件、调用链、状态、接口、注意事项和更新时间。
5. 追加 `docs/ai/CHANGELOG_AI.md`，记录日期、任务、改动文件、验证和后续风险。
6. 如果索引与代码冲突，以代码为准，并修正索引。

## 暂不读取/谨慎读取

- 不读取：`node_modules`、`dist`、`build`、`.next`、`coverage`、`.git`、大型日志和生成文件。
- 谨慎读取：`package-lock.json`、数据库文件、生产数据目录、完整 `public/index.html`。需要时优先按函数名/行号定向读取。

