# AI Changelog

本文件记录 AI 对仓库的维护历史。每次 AI 修改后追加一条，最新记录放在顶部或底部均可，但保持格式一致。

## 2026-09-01

- 类型：功能新增与权限调整
- 任务：将每日任务编辑权上提至管理员，并新增按周循环的用户独立任务表。
- 修改文件：
  - `src/utils.js`、`src/db.js`、`src/routes.js`、`src/index.js`：新增周模板归一化、按日期取星期任务、管理员保存接口、今天及未来快照刷新，以及识别码迁移模板。
  - `public/index.html`：用户中心改为只读今日任务；管理员面板新增周一至周日草稿编辑、排序和显式保存。
  - `test/weekly-tasks-api.test.js`、`test/frontend-syntax.test.js`：覆盖管理员鉴权、循环与旧模板兼容、历史快照、普通用户不可写入、识别码迁移、删除清理和前端控件。
  - `docs/ai/FEATURE_INDEX.md`：更新每日任务和管理员面板调用链。
- 验证：`node --check src/utils.js src/db.js src/routes.js src/index.js`、`npm test`（17/17）通过。

## 2026-07-16

- 类型：功能优化
- 任务：将用户中心的近 90 天趋势迁移到公开每日成绩页 `/u/:identifier`，并改为入口按钮。
- 修改文件：
  - `public/index.html`：移除用户中心趋势图，保留单日成绩并新增新标签打开的趋势入口。
  - `src/html.js`：公开页新增原生 SVG 趋势图及模式、配置、指标筛选；安全内嵌成绩 JSON。
  - `test/frontend-trends.test.js`、`test/mindfulness-records.test.js`：迁移趋势测试锚点并覆盖新页面入口。
  - `docs/ai/FEATURE_INDEX.md`：更新成绩、用户中心与公开成绩页调用链。
- 验证：`node --check src/html.js`、`npm test`（15/15）通过。

## 2026-07-16

- 类型：功能新增
- 任务：在用户中心每日成绩增加各训练模式近 90 天指标趋势图。
- 修改文件：
  - `public/index.html`：新增模式/配置/指标切换、每日原始值与 7 日趋势 SVG 图、90 天本地记录保留和时区归日。
  - `src/db.js`、`src/routes.js`：公开成绩同步返回服务器保留的完整近 90 天记录。
  - `src/utils.js`、`src/index.js`、`src/html.js`：统一按管理员时区归类每日记录与公开页任务进度。
  - `test/frontend-trends.test.js`、`test/training-scores.test.js`、`test/records-public-api.test.js`：覆盖趋势聚合、正念指标、跨午夜时区归日和完整成绩同步。
  - `docs/ai/FEATURE_INDEX.md`：更新成绩统计功能锚点和调用链。
- 验证：`npm test` 通过（13/13）；`node --check src/db.js src/routes.js src/utils.js src/index.js src/html.js` 通过；本地 `/health` 正常。浏览器运行环境无法连接宿主机 `127.0.0.1`，视觉烟测待可访问本地服务的环境执行。

## 2026-07-15

- 类型：功能优化
- 任务：正念练习增加开始前提示；用户可拖动或用方向键调整每日任务顺序。
- 修改文件：
  - `public/index.html`：新增分段提示，复用管理员行排序逻辑为任务列表提供触屏/鼠标拖动与键盘排序，并通过既有保存流程持久化。
  - `test/frontend-syntax.test.js`：覆盖提示和排序控件存在性及前端脚本编译。
  - `docs/ai/FEATURE_INDEX.md`：更新正念与每日任务调用锚点。
- 验证：`npm test` 通过（7/7）；本地服务无法在当前运行环境中保持后台监听，浏览器烟测待在可保持本地服务监听的环境执行。

## 2026-07-15

- 类型：功能新增
- 任务：正念每日任务可绑定指定音频；管理员可排序引导音频。
- 修改文件：
  - `src/audio-guides.js`：新增持久化音频目录、稳定 ID 与排序，改名保留 ID，删除移除目录项。
  - `src/routes.js`、`src/index.js`、`src/html.js`、`src/utils.js`：新增排序接口，记录/任务保存 `audioId`，公开任务报表识别改名与删除状态。
  - `public/index.html`：新增正念任务音频选择、失效提示、管理员拖拽/方向键排序与保存。
  - `test/audio-guides.test.js`、`test/audio-guide-api.test.js`、`test/mindfulness-records.test.js`：覆盖稳定 ID、排序、任务匹配与报表名称。
  - `docs/ai/FEATURE_INDEX.md`：更新正念、成绩、每日任务、管理员功能索引。
- 验证：`node --check src/audio-guides.js src/routes.js src/utils.js src/index.js src/html.js`、`npm test` 通过（6/6）。
- 后续风险：直接在磁盘改名/删除 MP3 会被目录同步视为旧音频删除和新音频加入；请通过管理员面板操作以保留绑定关系。

## 2026-07-14

- 类型：功能新增
- 任务：管理员可设置训练模式导航的显示状态与拖拽顺序。
- 修改文件：
  - `public/index.html`：新增导航配置列表、触屏/鼠标拖拽、键盘方向键排序和即时应用逻辑。
  - `src/routes.js`：`GET /api/settings` 返回 `trainingNavigation`；`PUT /api/admin/settings` 校验并保存完整配置。
  - `test/settings-api.test.js`：覆盖默认值、管理员鉴权、保存与非法配置拒绝。
  - `docs/ai/FEATURE_INDEX.md`：更新管理员面板功能单元。
- 验证：`node --check src/routes.js` 与 `node --test test/settings-api.test.js test/frontend-syntax.test.js` 通过。
- 后续风险：拖拽区域仅有 7 项，未实现长列表自动滚动；若未来扩展大量模式再补充。

## 2026-07-14

- 类型：功能新增
- 任务：新增正念练习、MP3 引导音频管理与对应记录/计时/每日任务支持。
- 修改文件：
  - `src/audio-guides.js`：新增默认音频初始化、MP3 校验、文件 CRUD；存储目录为数据库同级 `audio/`。
  - `src/routes.js`：新增公共音频列表/播放接口和管理员上传、重命名、删除接口。
  - `public/index.html`：新增正念模式、音频播放计时、成绩展示、每日任务选项及管理员音频管理 UI。
  - `src/utils.js`、`src/html.js`：保留并展示 `audioName`、`audioCompleted`，正念记录不显示错误率。
  - `Dockerfile`、`bgm1.mp3`：默认音频打包进镜像，首次运行复制到持久化目录。
  - `test/audio-guides.test.js`、`test/audio-guide-api.test.js`、`test/frontend-syntax.test.js`、`test/mindfulness-records.test.js`：新增文件生命周期、接口、前端语法、公开页与每日任务匹配测试；`package.json` 新增 `npm test`。
  - `docs/ai/PROJECT_INDEX.md`、`docs/ai/FEATURE_INDEX.md`：更新功能索引。
- 验证：
  - `npm test` 通过（5 项）；覆盖默认音频、Range 播放、管理员鉴权、上传、重命名、删除、前端脚本编译、公开页与每日任务匹配。
  - `node --check src/audio-guides.js src/routes.js src/utils.js src/html.js src/index.js` 通过。
- 后续风险：
  - 上传为单请求内存缓冲，50MB 上限适合小型管理员面板；若未来需要更大文件或断点续传，应改为受控流式上传。

## 2026-07-09

- 类型：功能优化
- 任务：允许同一用户多客户端同时登录，并保持记住我长期有效。
- 修改文件：
  - src/utils.js：新增 session token 列表解析与追加 helper，兼容旧单 hash。
  - src/routes.js：登录/注册追加 session hash，校验时接受任一有效 token。
  - test/session-tokens.test.js：新增无依赖 assert 测试。
  - docs/ai/FEATURE_INDEX.md：更新用户中心登录同步说明。
- 验证：
  - node --check src/utils.js、node --check src/routes.js、node --check test/session-tokens.test.js 通过。
  - node test/session-tokens.test.js 通过。


## 2026-06-13

- 类型：功能优化
- 任务：每日任务自动重置 — 在管理员时区 0:00 自动从模板生成当天任务，无需手动每日设置。
- 创建/更新文件：
  - `src/db.js`：新增 `task_templates` 表（`CREATE TABLE IF NOT EXISTS`），新增 `getTaskTemplate()`、`setTaskTemplate()`、`deleteTaskTemplate()` 函数；`deleteUser()` 增加 `task_templates` 清理。
  - `src/routes.js`：
    - `POST /users`：保存任务时同时写入模板。
    - `GET /users/:identifier`：当天无任务时自动从模板生成并写入 `tasks` 表。
    - `PUT /users/:identifier`：保存当天任务同时写入模板；空任务则清除模板。
  - `src/index.js`：`GET /u/:identifier`：公开页同样支持自动从模板生成。
  - `docs/ai/FEATURE_INDEX.md`：更新"每日任务"和"数据存储"功能单元。
  - `docs/ai/PROJECT_INDEX.md`：更新时间戳。
- 业务逻辑变更：
  - 用户/管理员设置每日任务后，服务端自动保存为模板。
  - 新的一天首次获取任务（`GET /users` 或 `GET /u/`）时，若当天尚无任务，自动从模板复制并写入当天日期，实现"每日 0:00 自动重置"效果。
  - 用户删除所有任务并保存后，模板也被清除，后续不再自动生成。
  - 删除用户时同步清理模板数据。
- 验证：
  - 运行 `node --check src/db.js`、`src/routes.js`、`src/index.js`、`src/utils.js`、`src/html.js` 语法检查全部通过。
  - 待运行 `npm start` 进行功能验证。

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

## 2026-06-12

- 类型：修复
- 任务：修复重置密码时报 `no such column: passwordHash` — `updateUser()` 中 camelCase 字段名未转为 snake_case 列名
- 修改文件：
  - `src/db.js`：`updateUser()` 中新增 `camelToSnake()` 辅助函数，生成 SQL SET 列名时将 camelCase 映射为 snake_case（如 `passwordHash` → `password_hash`）
- 根因说明：
  - 上一次修复（本日第 3 条）在 `fields` 数组中添加了 camelCase 别名使 `data` 匹配成功，但 `sets.push(\`${field} = ?\`)` 直接将 `passwordHash` 作为列名写入 SQL，与数据库表列名 `password_hash` 不匹配
- 验证：
  - 运行 `node --check src/db.js`、`src/routes.js`、`src/utils.js` 语法检查通过
  - 待启动 `npm start` 后用管理员重置密码功能验证
- 后续风险：`camelToSnake` 是简单正则转换，只处理单层大写字母（如 `passwordHash` → `password_hash`），如果有全大写缩写（如 `DBName` → `d_b_name` 而非 `db_name`），需改用白名单映射

## 2026-06-12

- 类型：修复
- 任务：修复三个管理面板问题 — (1) 错误管理密码不应打开面板；(2) 删除冗余"查询用户"按钮；(3) 管理面板修改密码不生效
- 创建/更新文件：
  - `src/routes.js`：新增 `POST /admin/verify` 端点，供前端登录前校验管理密码
  - `src/db.js`：`updateUser()` 的 `fields` 数组添加 camelCase 别名（`passwordHash`、`passwordSalt`、`passwordHashVersion`、`passwordUpdatedAt` 等），使管理员重置密码时传入的 `makePasswordRecord()` camelCase 字段能被正确匹配写入
  - `public/index.html`：
    - `adminLoginButton` click handler 改为先调 `POST /api/admin/verify` 服务端校验，成功才开面板；失败则显示错误不关弹窗
    - 删除"查询用户"按钮 HTML（`id="adminLookupButton"`）
    - 删除 `adminLookupButton` 变量声明和事件绑定
  - `docs/ai/FEATURE_INDEX.md`：更新"管理员面板与系统设置"功能单元
- 业务逻辑变更：
  - 面板打开：必须服务端校验密码通过，不再仅靠前端空字符串检查
  - 面板 UI：移除冗余"查询用户"按钮（`<select>` change 已触发相同 `adminLookup()`）
  - 修改密码：`updateUser()` 现在能正确匹配 `passwordHash`、`passwordSalt`、`passwordHashVersion`、`passwordUpdatedAt` 字段并写入数据库
- 根因说明（修改密码不生效）：
  - `updateUser()` 用 snake_case 字段名（`password_hash`）在 `data` 对象中查找
  - 管理员重置密码时传入 `...makePasswordRecord()` 返回 camelCase 键（`passwordHash`）
  - 所有密码字段被静默跳过，只有 `session_token_hash` 被清空
- 验证：
  - 运行 `node --check src/db.js`、`node --check src/routes.js` 语法检查通过
  - 待运行 `npm start` 后用浏览器验证三个修复点
## 2026-07-16

- 类型：功能新增
- 任务：为斯特鲁普、记忆和译码训练增加基于年龄的训练参考等第评分。
- 修改文件：
  - `src/utils.js`、`src/html.js`：新增共享评分、公开页展示和 `memorySpan` 云端归一化。
  - `public/index.html`：新增前端同构评分、无辅助记忆跨度记录，以及结果/记录等第展示。
  - `test/training-scores.test.js`：覆盖阈值、低龄、正确率、模式和历史记录兼容。
  - `docs/ai/SCORING_REFERENCE.md`、`docs/ai/FEATURE_INDEX.md`：记录依据和功能锚点。
- 验证：`node --check src/utils.js src/html.js`、`npm test` 通过（10/10）。
- 注意：等第为训练参考，非医学诊断；反向模式复用对应年龄表。
