# Feature Index

最近更新时间：2026-07-16

说明：P0 是默认必读文件；P1 是跨功能或后端联动时按需读取；P2 是大文件、部署文件、锁文件或历史说明，读取前应说明原因。`public/index.html` 是单文件前端，读取时优先按下列函数/DOM 锚点定向读取。

## 功能单元列表

- 应用入口与服务生命周期
- 舒尔特方格训练
- 斯特鲁普训练
- 成语训练
- 古诗训练
- 记忆训练
- 译码训练
- 正念练习与引导音频
- 成绩记录与统计
- 用户中心、登录与云端同步
- 每日任务
- 管理员面板与系统设置
- 公开用户成绩页
- 数据存储、安全与清理
- Docker 部署与运行配置

---

## 应用入口与服务生命周期

功能说明：启动 Express 服务，挂载 API，提供主页、公开页、古诗文本占位、健康检查，初始化数据库和默认时区。

用户入口：访问 `/`、`/health`、`/u/:identifier`；部署启动时执行 `npm start`。

P0：必须读取文件

- `src/index.js`（含 `app.set('trust proxy', 1)`、`SIGTERM`/`SIGINT` 处理器）
- `src/db.js`：`initDb`、`pruneAllOldRecords`、`getSetting`、`setSetting`

P1：按需读取文件

- `src/routes.js`：需要确认 API 挂载行为时读取
- `src/html.js`：需要确认页面渲染时读取

P2：谨慎读取文件

- `Dockerfile`
- `docker-compose.yml`
- `README.md`：当前文本可能乱码，仅作历史参考

主要调用链：`start()` -> `db.initDb()` -> `db.setSetting('timezone')` -> `db.pruneAllOldRecords()` -> `app.listen()`；请求链为 `app.use('/api', apiRoutes)` 或页面路由处理；关闭链为 `SIGTERM`/`SIGINT` -> `gracefulShutdown()` -> `db.flushDbSync()` -> `process.exit(0)`。

相关状态：环境变量 `PORT`、`ADMIN_PASSWORD`、`USER_CREATE_CODE`、`DB_PATH`；数据库 `settings.timezone`。

相关接口：`GET /`、`GET /health`、`GET /u/:identifier`、`GET /古诗.txt`、所有 `/api/*`。

修改注意事项：启动逻辑会影响所有功能；不要在未验证数据库初始化和健康检查前改动监听/中间件顺序。

最近更新时间：2026-06-12

---

## 舒尔特方格训练

功能说明：用户按顺序或倒序点击 3x3 到 7x7 数字方格，可开启颜色干扰和提示，完成后记录用时、错误、正确率。

用户入口：主页训练类型按钮“舒尔特”；尺寸按钮；倒序、颜色干扰、提示开关；每日任务卡片跳转。

P0：必须读取文件

- `public/index.html`：`currentTraining`、`buildBoard`、`buildSchulte`、`handleCell`、`completeRound`、`setTraining`、`setSize`
- `src/utils.js`：`SCORE_RULES`、`scoreSchulteRecord`、`scoreCloudSchulte`、`normalizeCloudRecord`

P1：按需读取文件

- `src/routes.js`：保存云端成绩 `/users/:identifier/records`
- `src/db.js`：`putRecord`、`getRecords`

P2：谨慎读取文件

- 完整 `public/index.html`：仅当样式/布局/交互牵涉多处时读取

主要调用链：按钮选择 -> `setTraining('schulte')` -> `buildBoard()` -> `buildSchulte()` -> `handleCell()` -> `completeRound()` -> `addRecord()` -> `syncRecordToCloud()`。

相关状态：`currentTraining`、`size`、`reverseOrderOn`、`colorInterferenceOn`、`hintOn`、`records`、localStorage 成绩键。

相关接口：`POST /api/users/:identifier/records`；公开页/任务进度会读取记录。

修改注意事项：舒尔特记录参与年龄评分和每日任务匹配；修改 record 字段时同步 `SERVER_TASK_MATCH_FIELDS`、前端 `dailyTaskSpecs` 和公开页展示。

最近更新时间：2026-06-12

---

## 斯特鲁普训练

功能说明：展示颜色词/色块，用户选择正确颜色或按文字含义答题，完成固定题量后记录成绩。

用户入口：主页训练类型按钮“斯特鲁普”；“文字答案”模式开关。

P0：必须读取文件

- `public/index.html`：`buildStroop`、`renderColorChoices`、`nextStroopPrompt`、`handleColorChoice`、`completeStroopRound`、`stroopTextAnswerOn`、`scoreTrainingRecord`

P1：按需读取文件

- `src/utils.js`：`scoreTrainingRecord`、`scoreCloudTrainingRecord`、`normalizeCloudRecord`、`trainingLabel`、`SERVER_TASK_MATCH_FIELDS.stroop`
- `src/routes.js`：成绩保存与任务读取接口

P2：谨慎读取文件

- 完整 `public/index.html`

主要调用链：`setTraining('stroop')` -> `buildBoard()` -> `buildStroop()` -> `nextStroopPrompt()` -> `handleColorChoice()` -> `completeStroopRound()` -> `addRecord()`。

相关状态：`currentTraining`、`stroopTextAnswerOn`、`errors`、`records`。

相关接口：`POST /api/users/:identifier/records`。

修改注意事项：任务匹配依赖 `textAnswer`；评分为训练参考，文字答案模式复用同龄阈值；若增加题量/颜色字段，要同步前后端任务描述和 record 归一化。

最近更新时间：2026-07-16

---

## 成语训练

功能说明：从打乱汉字中拼出成语，支持列数配置和颜色干扰，完成后记录成绩。

用户入口：主页训练类型按钮“成语”；成语列数模式按钮；颜色干扰开关。

P0：必须读取文件

- `public/index.html`：`buildIdiom`、`selectUniqueIdioms`、`handleIdiomCell`、`completeIdiomRound`、`setIdiomCols`

P1：按需读取文件

- `src/utils.js`：`normalizeCloudRecord`、`trainingLabel`、`SERVER_TASK_MATCH_FIELDS.idiom`
- `src/routes.js`：成绩保存与任务读取接口

P2：谨慎读取文件

- 完整 `public/index.html`：成语素材和 UI 可能分散在同一文件内

主要调用链：`setTraining('idiom')` -> `buildBoard()` -> `buildIdiom()` -> `handleIdiomCell()` -> `completeIdiomRound()` -> `addRecord()`。

相关状态：`idiomCols`、`currentIdioms`、`colorInterferenceOn`、`records`。

相关接口：`POST /api/users/:identifier/records`。

修改注意事项：成语素材位置和扩展方式待确认；修改列数/题型时同步每日任务配置 `cols`。

最近更新时间：2026-06-12

待确认：成语题库是否完全内嵌在 `public/index.html`，以及后续是否需要外置素材文件。

---

## 古诗训练

功能说明：从打乱诗句中按顺序点击还原古诗，支持颜色干扰、显示/隐藏全诗，完成后记录成绩。

用户入口：主页训练类型按钮“古诗”；颜色干扰开关；全诗显示按钮。

P0：必须读取文件

- `public/index.html`：`loadPoems`、`parsePoems`、`buildPoem`、`handlePoemCell`、`completePoemRound`
- `src/index.js`：`GET /古诗.txt`

P1：按需读取文件

- `src/utils.js`：`normalizeCloudRecord`、`trainingLabel`、`SERVER_TASK_MATCH_FIELDS.poem`
- `src/routes.js`：成绩保存与任务读取接口

P2：谨慎读取文件

- `README.md`：仅用于确认原始功能说明
- 完整 `public/index.html`

主要调用链：初始化 `loadPoems()` -> `fetch("古诗.txt")` -> `parsePoems()`；训练链为 `setTraining('poem')` -> `buildPoem()` -> `handlePoemCell()` -> `completePoemRound()` -> `addRecord()`。

相关状态：`poems`、`currentPoem`、`poemChars`、`colorInterferenceOn`、`records`。

相关接口：`GET /古诗.txt`、`POST /api/users/:identifier/records`。

修改注意事项：当前服务端 `GET /古诗.txt` 返回占位文本；如果恢复真实题库，需要确认编码和文件来源。古诗数据异常会直接影响前端 `loadPoems()`。

最近更新时间：2026-06-12

待确认：真实古诗数据文件是否缺失，当前占位路由是否符合预期。

---

## 记忆训练

功能说明：用户先记忆逐步增加的目标格，再按顺序点击复现；支持重播预览，完成后记录轮次、错误和重播次数。

用户入口：主页训练类型按钮“记忆”；开始记忆、复现按钮。

P0：必须读取文件

- `public/index.html`：`buildMemory`、`startMemoryTraining`、`addMemoryTarget`、`showMemoryPreview`、`replayMemoryPreview`、`handleMemoryCell`、`completeMemoryRound`、`memorySpan`

P1：按需读取文件

- `src/utils.js`：`scoreTrainingRecord`、`normalizeCloudRecord`、`trainingLabel`、`memoryReplaySuffix`
- `src/routes.js`：成绩保存接口

P2：谨慎读取文件

- 完整 `public/index.html`

主要调用链：`setTraining('memory')` -> `buildMemory()` -> `startMemoryTraining()` -> `showMemoryPreview()` -> `handleMemoryCell()` -> `completeMemoryRound()` -> `addRecord()`。

相关状态：`memoryActive`、`memoryPreviewing`、`memoryTargets`、`memoryReplayCount`、`memorySpan`、`memoryTotalRounds`、`records`。

相关接口：`POST /api/users/:identifier/records`。

修改注意事项：`memorySpan` 仅在当前轮无错误且未复现时提升；旧记录缺少该字段时显示暂无跨度数据，不得推测。

最近更新时间：2026-07-16

---

## 译码训练

功能说明：用户根据符号与字母对照表完成译码题，可切换正向/反向，完成后记录题量、答案、错误和正确率。

用户入口：主页训练类型按钮“译码”；译码反向开关。

P0：必须读取文件

- `public/index.html`：`buildDecode`、`renderDecodeAnswerPad`、`refreshDecodeCursor`、`handleDecodeChoice`、`completeDecodeRound`、`decodeReverseOn`、`scoreTrainingRecord`

P1：按需读取文件

- `src/utils.js`：`scoreTrainingRecord`、`scoreCloudTrainingRecord`、`normalizeCloudRecord`、`trainingLabel`、`SERVER_TASK_MATCH_FIELDS.decode`
- `src/routes.js`：成绩保存与任务读取接口

P2：谨慎读取文件

- 完整 `public/index.html`

主要调用链：`setTraining('decode')` -> `buildBoard()` -> `buildDecode()` -> `renderDecodeAnswerPad()` -> `handleDecodeChoice()` -> `completeDecodeRound()` -> `addRecord()`。

相关状态：`decodeReverseOn`、`decodeTotal`、`decodeAnswered`、`decodeAnswers`、`records`。

相关接口：`POST /api/users/:identifier/records`。

修改注意事项：任务匹配依赖 `reverse`；评分为训练参考，反向模式复用同龄阈值；如果修改符号表或题量，要同步记录展示和每日任务描述。

最近更新时间：2026-07-16

---

## 正念练习与引导音频

功能说明：用户通过原生 `<audio>` 播放 MP3 引导音频；播放/暂停驱动练习计时，播完自动记录，也可提前结束并记录。音频目录保存稳定 ID 与管理员排序，改名不影响已绑定任务。

用户入口：训练模块“正念练习”；管理员面板“引导音频”。

P0：必须读取文件

- `public/index.html`：`buildMindfulness`、练习前提示、`loadMindfulnessAudios`、`setMindfulnessAudioSource`、`completeMindfulnessRound`、音频事件与管理员音频管理函数
- `src/audio-guides.js`：`syncCatalog`、`listAudioGuides`、`createAudioGuide`、`renameAudioGuide`、`deleteAudioGuide`、`reorderAudioGuides`
- `src/routes.js`：`GET /audio-guides`、`GET /audio-guides/:id/file`、`POST/PUT/DELETE /admin/audio-guides`、`PUT /admin/audio-guides/order`
- `src/utils.js`：`SERVER_TASK_MATCH_FIELDS.mindfulness`、`normalizeCloudRecord`、`trainingLabel`

P1：按需读取文件

- `src/html.js`：公开成绩页的正念记录展示

P2：谨慎读取文件

- `Dockerfile`：默认 `bgm1.mp3` 打包入镜像
- `data/audio/`：生产上传音频，默认不要读取

主要调用链：进入模式 -> `GET /api/audio-guides` -> `<audio>` play/pause/ended -> `completeMindfulnessRound()` -> `addRecord()` -> 云端同步；管理链为管理员验证 -> 音频 CRUD/排序 API -> `src/audio-guides.js` 目录与文件操作。

相关状态：`mindfulnessAudios`、`mindfulnessAudio`、`records[].audioId/audioName/audioCompleted`、`audio/.audio-guides.json`。

修改注意事项：仅接受不超过 50MB 的 MP3；目录首次创建时复制 `bgm1.mp3`；改名保留稳定 ID，删除使指定任务失效且不会由其他音频完成；历史记录保留当次 `audioName`。

最近更新时间：2026-07-15

---

## 成绩记录与统计

功能说明：本地记录每次训练成绩，展示当前模式统计并可清空当前模式记录；用户中心“每日成绩”仅展示指定日期明细，并提供前往公开每日成绩页的趋势入口；公开页展示各训练模式近 90 天趋势，支持配置/指标筛选；正念模式展示累计/平均时长与完整播放次数；登录用户会同步记录到云端。

用户入口：完成训练结果弹窗；“成绩记录”按钮；“清空当前模式”按钮；公开成绩页。

P0：必须读取文件

- `public/index.html`：`loadRecords`、`saveRecords`、`addRecord`、`recordsForDate`、`syncRecordToCloud`、`recordsForCurrentTraining`、`refreshStats`、`refreshScorePanel`、`createRecordNode`、`renderFullRecords`、`showResult`、`clearRecords`
- `src/routes.js`：`POST /users/:identifier/records`、`GET /users/:identifier/public`
- `src/db.js`：`putRecord`、`getRecords`、`pruneAllOldRecords`

P1：按需读取文件

- `src/utils.js`：`scoreCloudRecord`、`normalizeCloudRecord`、`formatPracticeMs`、`trainingLabel`
- `src/html.js`：公开页成绩渲染、近 90 天趋势原生 SVG 与训练参考等第展示

P2：谨慎读取文件

- 数据库文件或 `data/` 目录：涉及生产数据，默认不要读取

主要调用链：训练完成 -> `addRecord(record)` -> `saveRecords()` -> `syncRecordToCloud(record)` -> `POST /api/users/:identifier/records` -> `db.putRecord()`；下载链为 `loadUserCenter()` -> `GET /api/users/:identifier/public` -> `mergeSyncedRecords()`；趋势链为 `GET /u/:identifier` -> `renderPublicUserPage()` -> `buildTrendSeries()` -> 原生 SVG；统计链为 `refreshScorePanel()` -> `refreshStats()` + `renderFullRecords()`。

相关状态：`records`、localStorage 成绩键、云端 `records` 表。

相关接口：`POST /api/users/:identifier/records`、`GET /api/users/:identifier/public`、`GET /u/:identifier`。

修改注意事项：本地和云端记录字段必须兼容；每日归日必须使用管理员时区，趋势窗口为今天含在内的 90 个日历日；趋势默认可合并配置，比较用时应筛选同配置；记忆新增可选 `memorySpan`，旧记录不推测评分；评分依据见 `docs/ai/SCORING_REFERENCE.md`；正念记录使用 `audioId`、`audioName`、`audioCompleted` 且不展示错误率；服务器只保留近 90 天记录清理逻辑在启动时执行。

最近更新时间：2026-07-16

---

## 用户中心、登录与云端同步

功能说明：用户可通过识别码/密码登录，登录后自动同步每日任务和练习记录；新用户可通过"注册用户"按钮打开独立注册弹窗创建账号；已登录或已载入识别码的用户可通过“查看近 90 天趋势”按钮在新标签打开公开每日成绩页。

用户入口：顶部"用户中心"按钮；用户中心内"注册用户"按钮；用户中心内"登录并同步数据"按钮；用户中心内"查看近 90 天趋势"按钮。

  P0：必须读取文件

- `public/index.html`：`openUserCenter`、`loadUserCenter`、`loadSyncedUserByIdentifier`、`persistUserCenter`、`saveUserProfile`、`openRegisterDialog`、`registerUser`、`loadCloudUser`、`saveCloudUser`、`loadLoadedUserIdentifier`、`saveLoadedUserIdentifier`、`apiJson`、`applyUserToForm`
- `src/routes.js`：`POST /users`、`GET /users/:identifier`、`PUT /users/:identifier`、`DELETE /users/:identifier`、`POST /users/:identifier/login`、`POST /users/:identifier/verify-session`
- `src/utils.js`：`normalizeCloudUser`、`validIdentifier`、`validPassword`、`makePasswordRecord`、`verifyPassword`、`sessionTokenHash`
- session storage: session_token_hash stores multiple hashes as JSON and accepts old single-hash values.

P1：按需读取文件

- `src/db.js`：`createUser`、`updateUser`、`renameUserIdentifier`、`deleteUser`、`getUser`

P2：谨慎读取文件

- `.env.example`：确认授权码/管理员密码说明时读取
- `README.md`：历史说明可能乱码

主要调用链：用户中心打开 -> `loadUserCenter()`（自动验证 sessionToken 有效性，若无效清除登录状态）；注册 -> `openRegisterDialog()` -> `registerUser()` -> `POST /api/users`；登录 -> `loadSyncedUserByIdentifier()` -> `POST /api/users/:id/login` -> 同步每日任务和练习记录；保存 -> `saveUserProfile()` -> `persistUserCenter()` -> `PUT /api/users/:id`。

相关状态：`cloudUser`、`loadedUserIdentifier`、`dailyTasks`、sessionToken、localStorage 用户键。

相关接口：`POST /api/users`、`GET /api/users/:identifier`、`PUT /api/users/:identifier`、`DELETE /api/users/:identifier`、`POST /api/users/:identifier/login`、`POST /api/users/:identifier/verify-session`。

修改注意事项：不要把明文密码或 session hash 返回给前端；修改识别码时必须保持用户、任务、成绩表同步迁移；登录接口必须验证密码后才返回 sessionToken；verify-session 端点只做 token 校验，不应返回敏感信息；`applyUserToForm` 控制用户资料编辑字段与公开成绩页链接的可见性和 URL。

最近更新时间：2026-07-16

---

## 每日任务

功能说明：管理员可为每个用户配置周一至周日循环任务表；用户仅查看当天任务与进度，顶部任务条可跳转至下一项。服务端按管理员时区的星期从周模板生成每日任务快照，任务进度由当天训练记录匹配计算。

用户入口：用户中心"今日任务"只读列表；顶部任务条；公开成绩页的任务进度；管理员面板"周任务表"编辑、排序和保存。

P0：必须读取文件

- `public/index.html`：`dailyTaskSpecs`、`buildTaskFromControls`、`renderTasks`、`renderAdminWeeklyTasks`、`saveAdminWeeklyTaskOrder`、`saveAdminWeeklyTasks`、`activateTask`
- `src/utils.js`：`normalizeCloudTasks`、`normalizeWeeklyCloudTasks`、`tasksForWeeklyTemplate`、任务匹配与进度函数
- `src/routes.js`：`getOrCreateDailyTasks`、`GET /users/:identifier`、`PUT /users/:identifier`、`PUT /admin/users/:identifier/weekly-tasks`
- `src/db.js`：`getTasks`、`putTasks`、`deleteTasksFromDate`、`getTaskTemplate`、`setTaskTemplate`

P1：按需读取文件

- `src/html.js`：公开页任务渲染

P2：谨慎读取文件

- 完整 `public/index.html`

主要调用链：管理员选择用户 -> `GET /api/admin/users/:id` -> 编辑周任务表 -> `PUT /api/admin/users/:id/weekly-tasks` -> `db.setTaskTemplate()` + 清理今天及未来快照 -> 重建今天任务；读取链为 `GET /users/:identifier`、登录或公开页 -> `getOrCreateDailyTasks()` / 周模板按星期取任务 -> `db.putTasks()`；进度链为 `recordsForDate()` -> `taskProgress()` / 服务端 `applyCloudTrainingCompletionToTasks()`。

相关状态：`dailyTasks`、`adminWeeklyTasks`、`adminWeekday`、当天日期 `todayKey()`、任务字段 `module/mode/targetCount/completedCount`、数据库 `task_templates` 表（JSON 为 `mon` 至 `sun`）。

相关接口：`GET /api/users/:identifier?date=YYYY-MM-DD`、`PUT /api/users/:identifier`、`GET /api/admin/users/:identifier`、`PUT /api/admin/users/:identifier/weekly-tasks`、`GET /u/:identifier`。

修改注意事项：普通用户资料更新不得写入任务；新增训练模式或任务字段时必须同时更新前端 `dailyTaskSpecs` 和后端 `SERVER_TASK_MATCH_FIELDS`；旧数组模板读取时须保持七天相同；管理员保存周表仅清理今天及未来快照，删除用户或改识别码时须同步处理模板。

最近更新时间：2026-09-01

---

## 管理员面板与系统设置

功能说明：点击标题 5 次打开管理员登录，输入密码后通过 `POST /api/admin/verify` 服务端校验，校验通过后进入管理面板，可查看用户、独立编辑并保存其周任务表、管理/排序引导音频、重置密码、删除用户、设置系统时区，以及拖拽配置训练模式导航的显示与顺序。

用户入口：主页标题连续点击 5 次 -> 管理员登录弹窗 -> 输入密码 -> 服务端验证 -> 管理面板。

P0：必须读取文件

- `public/index.html`：`adminClickCount`、`adminAuthHeaders`、`renderAdminWeeklyTasks`、`saveAdminWeeklyTasks`、导航、音频和用户管理函数
- `src/routes.js`：管理员用户接口、`PUT /admin/users/:identifier/weekly-tasks`、音频、设置和验证接口

P1：按需读取文件

- `src/db.js`：`listUsers`、`getUser`、`updateUser`、`deleteUser`、`getSetting`、`setSetting`
- `src/utils.js`：`makePasswordRecord`、`validPassword`

P2：谨慎读取文件

- `.env.example`
- `docker-compose.yml`：确认生产环境变量时读取

主要调用链：标题点击 -> 管理登录弹窗 -> `POST /api/admin/verify` -> 成功则加载用户、周任务表、设置和音频；周任务表 -> `GET /api/admin/users/:id` -> 草稿编辑/排序 -> `PUT /api/admin/users/:id/weekly-tasks`；模式导航与音频排序保持原调用链。

相关状态：`adminPassword`、`adminClickCount`、`settings.timezone`、`settings.training_navigation`、前端 `appSettings.trainingNavigation`。

相关接口：`GET /api/admin/users`、`GET /api/admin/users/:identifier`、`PUT /api/admin/users/:identifier/weekly-tasks`、`POST /api/admin/users/:identifier/password`、`DELETE /api/admin/users/:identifier`、`PUT /api/admin/audio-guides/order`、`GET /api/settings`、`PUT /api/admin/settings`、`POST /api/admin/verify`。

修改注意事项：管理员鉴权当前依赖环境变量 `ADMIN_PASSWORD`；接口受 `/api/admin` rate limit 保护。导航配置必须包含 7 个已知模式、无重复且至少一个可见；隐藏仅影响顶部导航，不影响每日任务配置和跳转。

最近更新时间：2026-09-01

---

## 公开用户成绩页

功能说明：无需登录即可查看指定用户当天任务进度、近 90 天训练记录摘要，以及按训练模式、配置和指标筛选的近 90 天趋势图。

用户入口：访问 `/u/:identifier`；API `/api/users/:identifier/public`。

P0：必须读取文件

- `src/index.js`：`GET /u/:identifier`
- `src/html.js`：`renderPublicUserPage`、`TREND_SCRIPT`、`TREND_RENDER_SCRIPT`、`TREND_BOOTSTRAP_SCRIPT`
- `src/utils.js`：`applyCloudTrainingCompletionToTasks`、`cloudTaskText`、`scoreCloudSchulte`、`formatPracticeMs`、`trainingLabel`

P1：按需读取文件

- `src/db.js`：`getUser`、`getRecords`、`getTasks`
- `src/routes.js`：`GET /users/:identifier/public`

P2：谨慎读取文件

- 完整 `public/index.html`：仅当需要保持公开页和主应用展示一致时读取

主要调用链：`GET /u/:identifier` -> `db.getUser()` -> `db.getRecords()` -> `db.getTasks()` -> `applyCloudTrainingCompletionToTasks()` -> `renderPublicUserPage()`。

相关状态：`settings.timezone`、`records`、`tasks`、用户 `birthDate`。

相关接口：`GET /u/:identifier`、`GET /api/users/:identifier/public`。

修改注意事项：公开页必须避免泄露密码/session/token 字段；服务端渲染字符串需使用 `escapeHtml`；内嵌趋势记录 JSON 必须转义 `<`，避免用户内容闭合 script 标签。

最近更新时间：2026-07-16

---

## 数据存储、安全与清理

功能说明：初始化和维护 SQLite 表，保存用户、每日任务、训练记录和设置；处理密码哈希、session token hash、旧记录清理。

用户入口：无直接 UI；所有登录、同步、公开页、管理功能都会依赖。

P0：必须读取文件

- `src/db.js`
- `src/utils.js`：密码/session、归一化、校验和公开字段过滤函数
- `src/routes.js`：`requireSession`、`issueSession`、`hasAdminAccess`
- `src/audio-guides.js`：MP3 名称校验、文件头校验与 `data/audio` CRUD
- `src/index.js`：`gracefulShutdown`、`SIGTERM`/`SIGINT` 注册

P1：按需读取文件

- `src/index.js`：启动初始化和清理调用

P2：谨慎读取文件

- `data/`：生产/本地数据库，默认不要读取
- `package-lock.json`：仅依赖调查时读取

主要调用链：`db.initDb()` -> `initTables()`；用户接口 -> `makePasswordRecord()` / `verifyPassword()` / `sessionTokenHash()`；训练记录 -> `normalizeCloudRecord()` -> `db.putRecord()`；关闭流程 -> `SIGTERM` -> `db.flushDbSync()`（同步刷盘）。

相关状态：SQLite 表 `users`、`tasks`、`records`、`settings`、`task_templates`；`saveTimer`、`savePending`。

相关接口：所有 `/api/users/*`、`/api/admin/*`、`/api/settings`、`/u/:identifier`。

修改注意事项：表结构变更需考虑已有 sql.js 文件兼容；上传音频不写入数据库，必须校验名称和文件头且防止路径穿越；不要返回敏感字段；数据库保存是异步延迟写入，关键写入验证要留意落盘时机。

最近更新时间：2026-07-14

---

## Docker 部署与运行配置

功能说明：构建生产容器，挂载数据目录，配置环境变量、健康检查、重启策略和日志轮转。

用户入口：运维执行 Docker/Docker Compose 命令。

P0：必须读取文件

- `Dockerfile`
- `docker-compose.yml`
- `docker-entrypoint.sh`
- `.env.example`

P1：按需读取文件

- `package.json`
- `src/index.js`：端口、健康检查、启动入口

P2：谨慎读取文件

- `package-lock.json`：依赖锁调查时读取
- `README.md`：部署说明可能乱码，仅参考

主要调用链：Docker build -> `npm ci --omit=dev` + 复制 `bgm1.mp3` -> `docker-entrypoint.sh`（chown /app/data）-> `su-exec app node src/index.js`；Compose -> 挂载 `./data:/app/data`（含 `audio/`）-> `/health` 健康检查。

相关状态：`PORT`、`ADMIN_PASSWORD`、`USER_CREATE_CODE`、`DB_PATH`、`NODE_ENV`。

相关接口：`GET /health`。

修改注意事项：不要随意升级 Node 或依赖；变更数据路径/用户权限时必须验证容器能写入数据库。

最近更新时间：2026-07-14
