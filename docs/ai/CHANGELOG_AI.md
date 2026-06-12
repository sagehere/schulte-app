# AI Changelog

本文件记录 AI 对仓库的维护历史。每次 AI 修改后追加一条，最新记录放在顶部或底部均可，但保持格式一致。

## 2026-06-12

- 类型：初始化 AI 维护文档
- 任务：建立“AI 功能索引驱动维护”模式，减少后续维护时的默认全项目读取和 token 消耗。
- 创建/更新文件：
  - `AGENTS.md`
  - `docs/ai/PROJECT_INDEX.md`
  - `docs/ai/FEATURE_INDEX.md`
  - `docs/ai/CHANGELOG_AI.md`
- 业务代码：未修改
- 识别出的功能单元：
  - 应用入口与服务生命周期
  - 舒尔特方格训练
  - 斯特鲁普训练
  - 成语训练
  - 古诗训练
  - 记忆训练
  - 译码训练
  - 成绩记录与统计
  - 用户中心、登录与云端同步
  - 每日任务
  - 管理员面板与系统设置
  - 公开用户成绩页
  - 数据存储、安全与清理
  - Docker 部署与运行配置
- 待确认：
  - 成语题库是否完全内嵌在 `public/index.html`，以及后续是否需要外置素材文件。
  - 真实古诗数据文件是否缺失，当前 `GET /古诗.txt` 占位路由是否符合预期。
  - CodeGraph 当前未初始化，后续是否需要运行 `codegraph init -i`。
- 验证：
  - 文档初始化完成；未运行应用级测试，因为本次不修改业务代码。

## 2026-06-12

- 类型：功能优化
- 任务：修复用户不用输入密码即可登录的问题；将注册功能收口到独立弹窗；确认数据同步功能正常。
- 修改文件：
  - `public/index.html`：
    - 添加注册弹窗 HTML 结构（`registerDialog`）
    - 修改用户中心界面，移除注册字段（授权码、注册/改密密码），添加"注册用户"按钮
    - 修改 `loadSyncedUserByIdentifier()` 函数，要求必须输入密码才能登录并同步数据
    - 添加 `openRegisterDialog()` 和 `registerUser()` 函数
    - 添加注册弹窗相关事件绑定
    - 移除不再使用的 DOM 元素引用（`authCodeInput`、`userPasswordInput`、`loadUserButton`）
  - `docs/ai/FEATURE_INDEX.md`：
    - 更新"用户中心、登录与云端同步"功能单元的说明和调用链
- 业务逻辑变更：
  - 登录流程：必须输入密码才能登录并同步每日任务和练习记录
  - 注册流程：点击"注册用户"按钮打开独立注册弹窗，填写信息后注册
  - 数据同步：登录后自动同步每日任务和练习记录（最多100条）
- 验证：
  - 运行 `node --check src/routes.js`、`node --check src/utils.js`、`node --check src/db.js` 语法检查通过
  - 待运行 `npm start` 进行功能验证

## 2026-06-12

- 类型：修复 + 重构
- 任务：修复已存在用户不用密码即可登录问题；收口建立用户组件到"注册用户"按钮；用户同步数据包含每日任务和练习记录。
- 创建/更新文件：
  - `src/routes.js`：新增 `POST /api/users/:identifier/verify-session` 端点，用于前端校验 session 有效性
  - `public/index.html`：
    - `loadUserCenter()` 添加 session 有效性验证（Task 1），session 过期后自动清除本地登录状态
    - `loadUserCenter()` 添加云端记录同步（Task 3），自动下载并合并远程记录
    - `applyUserToForm()` 添加用户资料编辑字段可见性控制（Task 2），无用户时隐藏编辑字段和保存/登出按钮
    - 给 `.user-grid` 添加 `id="userProfileFields"` 用于 DOM 操作
  - `docs/ai/FEATURE_INDEX.md`：更新"用户中心、登录与云端同步"功能单元
- 业务逻辑变更：
  - Task 1：页面初始化或打开用户中心时，若有保存的 sessionToken，先请求 `verify-session` 校验其有效性；若无效则清除本地登录状态并提示重新登录
  - Task 2：未创建/登录用户时，用户中心的"用户资料"字段、保存和登出按钮自动隐藏，仅保留"注册用户"按钮作为入口；点击"注册用户"打开独立注册弹窗
  - Task 3：`loadUserCenter()` 中，当有写入权限时额外调用 `GET /api/users/:identifier/public` 下载云端记录并合并到本地
- 验证：
  - 运行 `node --check src/routes.js`、`node --check src/utils.js`、`node --check src/db.js`、`node --check src/index.js`、`node --check src/html.js` 语法检查全部通过
  - 待运行 `npm start` 进行功能验证
- 后续风险：
  - verify-session 新增了网络开销（每次 init 和打开用户中心时多一次 POST 请求），建议用户量增大后考虑加缓存或合并进 GET /users/:identifier

## 2026-06-12

- 类型：修复 + 功能优化
- 任务：将"保存用户"按钮改名为"保存修改"；修复 Docker EACCES 权限错误和 X-Forwarded-For 警告
- 创建/更新文件：
  - `public/index.html`：按钮文字"保存用户"→"保存修改"
  - `src/index.js`：添加 `app.set('trust proxy', 1)` 修复 express-rate-limit X-Forwarded-For 警告
  - `Dockerfile`：安装 `su-exec`，添加 `ENTRYPOINT` 脚本，移除 `USER app`（通过 entrypoint 降权）
  - `docker-entrypoint.sh`：新建，运行时 chown /app/data 后 `su-exec app` 降权启动 node
  - `docs/ai/FEATURE_INDEX.md`：更新"应用入口"和"Docker"功能单元的 P0 文件列表和调用链
- 业务逻辑变更：
  - 按钮改名：用户中心的"保存用户"改为"保存修改"，语义更清晰
  - X-Forwarded-For：Express 启用 `trust proxy: 1`，消除 express-rate-limit 的 ValidationError 日志污染
  - EACCES：容器启动时 entrypoint 以 root 身份执行 `chown -R app:app /app/data`（处理 bind mount 的 root 权限问题），然后通过 `su-exec app` 降权至 app 用户运行 node，保持最低权限原则
- 验证：
  - 运行 `node --check src/index.js`、`node --check src/routes.js`、`node --check src/db.js`、`node --check src/utils.js`、`node --check src/html.js` 语法检查全部通过
  - 待运行 `docker-compose up -d` 验证容器无 EACCES/ValidationError 错误

## 2026-06-12

- 类型：修复
- 任务：修复 Docker 容器重启时用户数据丢失（"恢复成古早版本"的问题）
- 创建/更新文件：
  - `src/db.js`：新增 `flushDbSync()` 同步刷盘函数（取消待写定时器，用 `fs.writeFileSync` 确保落盘后再退出），并导出
  - `src/index.js`：导入 `flushDbSync`，添加 `gracefulShutdown()` 函数，注册 `SIGTERM`/`SIGINT` 信号处理器
  - `docs/ai/FEATURE_INDEX.md`：更新"应用入口"和"数据存储"功能单元的 P0 文件、调用链
- 业务逻辑变更：
  - 新增 `db.flushDbSync()`：运行时同步将内存 SQLite 写入磁盘文件
  - 新增信号处理器：`SIGTERM`/`SIGINT` 触发时先同步刷盘再退出，确保 `docker-compose up -d` 重启时不丢失倒数 100ms 内未落盘的数据
- 根因说明：
  - `saveDb()` 使用 100ms 防抖 + `fs.writeFile`（异步回调），进程退出时定时器和回调都不会执行
  - 新用户/记录的数据仅存在于内存，从未写入磁盘文件
  - 容器重新启动后加载的是上一次成功写入的"古早版本"数据库
- 验证：
  - 运行 `node --check src/db.js`、`node --check src/index.js`、`node --check src/routes.js`、`node --check src/utils.js`、`node --check src/html.js` 语法检查全部通过
  - 待运行 `docker-compose up -d` 后创建用户并重启容器，验证数据不丢失
