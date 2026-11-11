# Feature Index

最近更新时间：2026-09-08

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

功能说明：练习首次操作即登记开始记录，完成后更新同一记录；中断保留未完成留痕。统计、最佳成绩、趋势和每日任务只采用已完成记录，正念提前结束保留练习时长。用户中心“每日成绩”仅展示指定日期明细，并提供前往公开每日成绩页的趋势入口。

用户入口：完成训练结果弹窗；“成绩记录”按钮；“清空当前模式”按钮；公开成绩页。

P0：必须读取文件

- `public/index.html`：`ensureAttemptStarted`、`abandonActiveAttempt`、`addRecord`、`syncRecordToCloud`、`refreshStats`、`createRecordNode`
- `src/routes.js`：`POST /users/:identifier/records/start`、`POST /users/:identifier/records`、`POST /users/:identifier/records/:id/interrupt`
- `src/db.js`：`getRecord`、`putRecord`、`getRecords`

P1：按需读取文件

- `src/utils.js`：`scoreCloudRecord`、`normalizeCloudRecord`、`formatPracticeMs`、`trainingLabel`
- `src/html.js`：公开页成绩渲染、近 90 天趋势原生 SVG 与训练参考等第展示

P2：谨慎读取文件

- 数据库文件或 `data/` 目录：涉及生产数据，默认不要读取

主要调用链：首次操作 -> `ensureAttemptStarted()` -> `POST /records/start` -> `db.putRecord()`；完成 -> `addRecord()` -> `POST /records` 更新原记录；重开/切换 -> `abandonActiveAttempt()` -> `POST /records/:id/interrupt`；下载链为 `loadUserCenter()` -> `GET /public` -> `mergeSyncedRecords()`。

相关状态：`records`、localStorage 成绩键、云端 `records` 表。

相关接口：`POST /api/users/:identifier/records/start`、`POST /api/users/:identifier/records`、`POST /api/users/:identifier/records/:id/interrupt`、`GET /api/users/:identifier/public`、`GET /u/:identifier`。

修改注意事项：新记录使用 `status`、`startedAt`、`endedAt`、`interruptionReason`；无 `status` 的历史记录兼容为已完成。未完成不得用于任务、评分、趋势或最佳成绩；服务器拒绝未经开始登记的完成提交。

最近更新时间：2026-09-08

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

主要调用链：标题点击 -> 管理登录弹窗 -> `POST /api/admin/verify`（仅校验JSON中输入的管理密码，不使用普通用户Bearer）-> 成功则加载用户、周任务表、设置和音频；周任务表 -> `GET /api/admin/users/:id` -> 草稿编辑/排序 -> `PUT /api/admin/users/:id/weekly-tasks`；模式导航与音频排序保持原调用链。

相关状态：`adminPassword`、`adminClickCount`、`settings.timezone`、`settings.training_navigation`、前端 `appSettings.trainingNavigation`。

相关接口：`GET /api/admin/users`、`GET /api/admin/users/:identifier`、`PUT /api/admin/users/:identifier/weekly-tasks`、`POST /api/admin/users/:identifier/password`、`DELETE /api/admin/users/:identifier`、`PUT /api/admin/audio-guides/order`、`GET /api/settings`、`PUT /api/admin/settings`、`POST /api/admin/verify`。

修改注意事项：管理员鉴权依赖环境变量 `ADMIN_PASSWORD`；不存入用户数据库。`apiJson` 不向 `/api/admin/` 自动附普通用户令牌，管理操作继续显式使用 `adminAuthHeaders`，验证接口仅比较JSON password（兼容旧客户端携带普通Bearer）。接口仍受 rate limit 保护。导航当前为10项，兼容旧7项；隐藏仅影响顶部导航，不影响任务跳转。`test/admin-auth.test.js` 覆盖登录冲突、错误密码、未配置密码及权限隔离。

最近更新时间：2026-11-09

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


## 段落理解、因果推理与数学读题（当前）

最近更新时间：2026-11-09

- P0：`src/learning.js`、`src/modules.js`、`src/content/learning.json`、`public/learning.html`、`public/assets/learning.js`、`public/assets/learning.css`、`test/learning-api.test.js`。
- P1：`src/db.js`（`learningSessions`/`saveLearningSession`、`learning_sessions` 表、用户删除/迁移）、`src/routes.js`（学习路由与导航注册）、`src/utils.js`（三模块任务匹配）、`public/index.html`（入口、每日任务及用户隔离）。
- API：`GET /api/learning/catalog`、`POST /api/learning/start`、`POST /api/learning/:id/action`、`GET /api/learning/export`。使用 `x-user-id` + Bearer session；管理员凭据亦可访问指定用户。
- 状态：单元版本快照、逐步答案与提示、事件去重ID、未完成/完成、独立答对标记。开始与每次提交同步刷盘；重复 eventId 不重复累计。完成时派生成绩摘要供每日任务匹配，详情不经过公开 API。
- 内容：90个练习单元（每模块/每层次10个）、18份独立检查；含基础/连接/迁移、家长报告、观察及CSV。独立检查层次不足时保持观察，不对开放口头表达自动评分。
- 新导航注册表为10项，旧7项设置读取时补入新增模块。新模块进入独立学习页，不调用原七模式的棋盘渲染。
- 同期数据修复：本地记录按 ownerIdentifier 过滤；同ID云端记录替换已同步本地记录；出生日期仅授权读取；数据库使用临时文件原子替换，旧记录每天清理；正念已结束的提前退出记录进入趋势。
- 注意：学习详情当前持续保留，摘要90天清理；完成单元代表学完，不等于掌握；列式仅接受内容包列出的答案变式。

首轮验收补充（2026-11-09）：`public/index.html:prepareUserChange` 在账号变化前结束旧练习，改识别码后迁移本地 ownerIdentifier。`scripts/browser-smoke.cjs` 提供可选真实 Chromium 移动视口验收（Playwright 模块与浏览器路径由环境配置，不是应用运行依赖）。


## 理解训练教学闭环（第三阶段）

最近更新时间：2026-11-09

- P0：`src/learning-progress.js`（`buildLearningPlan`、`POLICY`、按管理员时区计算证据和复习日）、`src/learning.js`（`view`、`summary`、`shuffleCheck`、开始/提交/导出）、`src/content/checks.json`、`src/content/learning.json`、`public/assets/learning.js`、`public/learning.html`。
- P1：`src/utils.js`（任务归一化/匹配/描述）、`public/index.html`（learningTaskControls/learningTaskSkills、任务跳转与前端匹配）。为接入周任务读取这两处跨功能代码。
- 会话新增字段：`phase=train|check|review`、`fresh`、`focusSkill`；单元版本和随机选项顺序保存在原快照中。旧记录按首次材料接触兼容；同一材料新版本不自动当作未见材料。
- `GET /api/learning/catalog` 保留原 units（练习），新增 checks 与 plan（skills/reviews/recommendations/policy）。独立检查未完成时 view/公开摘要/export 均不暴露正确性或解释；服务端拒绝 hint/demo/reveal。skip 为检查专用；题目结束后释放解释。检查重复使用返回409，重复事件仍幂等。
- 新任务条件：mode.learningPhase、learningLevel、learningSkill；成绩摘要对应 learningPhase、learningLevel、learningSkills。省略条件是通配。私有学习详情仍只经授权API返回。
- 验证：`test/learning-checks.test.js`、`test/learning-progress.test.js`、原测试；`scripts/browser-learning-cycle.cjs` 用独立临时数据验证换材料复习、检查恢复及周任务流程。
- 无到期项目时可自主选择材料复习；前端按单元及phase续接未完成会话，避免把普通练习误算成指定复习任务。
- 注意：8份未见材料/2日/80%是产品默认规则而非能力常模；题量不足保持观察。按技能建议，不锁定用户手动层次。复习队列在页面访问时计算，无推送或额外后台服务。


## 90单元题库与家长报告（第四阶段）

最近更新时间：2026-11-09

- P0：`src/content/learning.json`（90单元，保留原19个ID及内容）、`src/learning-report.js`（`reportRange`、`buildReport`、`toCsv`）、`src/parent-routes.js`、`public/parents.html`、`public/assets/parents.js`、`public/assets/parents.css`。
- P1：`src/db.js`（`learning_observations` 表及CRUD、用户迁移/删除）、`src/learning.js`（家长路由挂载、JSON v3）、`src/index.js`（/parents页面）、`public/index.html`（管理员报告入口与三级任务）、`src/learning-progress.js`（三级建议）、`src/utils.js`（三级任务归一化）。为报告与账户生命周期接入定向读取以上代码。
- 私有API：`GET /api/learning/parents/report`、`PUT/DELETE /api/learning/parents/observations/:id`、`GET /api/learning/parents/export`。继承原owner/session/admin鉴权，no-store；JSON export v3增加observations。
- 参数：from/to（管理员时区日历日，最长366天且不得晚于今天）、module；CSV kind=steps/skills/observations。比较期为前一个等长区间；只比较同技能/层次/phase的未见材料，一材料一技能仅一个样本；两期各3份且跨2日才计算变化。
- 状态：观察JSON含date/context/module/sessionId/stepIndex/tags/note/revision/lastMutation；同mutation幂等、旧revision冲突409、跨用户读取/修改被拒绝。匿名静态页面不含私有数据，未完成检查不会进入报告作答/CSV或泄露正确性。
- 验证：内容唯一性与算式一致性、40项Node测试；三套Chromium移动视口脚本，新增browser-parents覆盖观察CRUD、CSV、权限、管理员访问、层次筛选。无新依赖。
- 注意：报告复用用户或管理员权限；家长标签不覆盖客观判分。原检查库保留18份，没有迁移层检查时不认定迁移掌握。题库尚需实际试用反馈；下一步为家庭试用与修订。

## 家庭试用与题目反馈（第五阶段）

最近更新时间：2026-11-09

- P0：`src/parent-routes.js`（`context`/`visibleStep`、feedback-context、bundle导出）、`src/learning-report.js`（扩展观察标签）、`public/assets/parents.js`（`trialDays`/`renderTrial`/`linkedFeedback`）、`public/parents.html`、`public/assets/parents.css`、`docs/FAMILY_TRIAL.md`。
- P1：`public/assets/learning.js:render`、`public/learning.html`；从具体步骤打开私有反馈页，session/step参数不含凭据。`src/learning.js:view` 用于未完成检查遮蔽，原路由已传入，无需修改。
- API：`GET /api/learning/parents/feedback-context?sessionId=...&stepIndex=...`，只允许本人已有会话及已显示步骤；返回ID/版本/层次/问题/选项，不返回答案。观察保存亦校验步骤可见性。
- `GET /api/learning/parents/export?kind=bundle&from=...&to=...&module=...` 返回JSON v1，kind=family-trial；期间开始或完成的会话及期间观察关联会话（可早于区间），导出时快照；已完成保留完整题目与随机选项，未完成独立检查只经view，无答案/讲解/正确性。报告统计口径不变，原CSV与全量JSON v3不变。
- 状态：沿用learning_observations及版本冲突保护；新增六个内容/操作问题标签。14天日历仅为参考，起始日使用localStorage键`schulte.trial.start.<owner>`，不写周任务或虚构完成；未来日期不请求报告，进行中截至今天。
- 验证：`test/parent-api.test.js` 新增4个子测试；`scripts/browser-parents.cjs` 新增弹页反馈、日历闰日/账号隔离、期间报告与JSON下载、移动视口。无新依赖、表或后台服务。
- 后续：实际家庭试用尚待进行，题目与提示修订须基于真实反馈；不推断两周效果，不改历史快照。

## 统一样式与适龄AI生成

最近更新时间：2026-11-11

- P0：`public/assets/app.css`（原首页样式原样提取）、`public/assets/learning.css`/`parents.css`、`public/index.html`/`learning.html`/`parents.html`（共用CSS）、`public/assets/learning.js`（profile/生成/稳定ID重试）、`src/learning-age.js`（按管理员时区算年龄、备用内容资格）、`src/learning-ai.js`（配置/有界JSON读取/结构及算式校验/两次API调用）、`src/learning.js`（catalog/generate/start/snapshot）。
- P1：`src/db.js:getUser`提供私有生日、原会话持久化；`src/learning-report.js`与`src/parent-routes.js`按来源/适龄段分别统计，建议仅从当前适龄材料中选择；`docker-compose.yml`/`.env.example`新增可选AI环境变量，密码配置不变。跨功能读取理由为年龄、复用报告及部署配置接入。
- API：`POST /api/learning/generate`使用原owner/session/admin鉴权，参数id/module/phase/level/focusSkill；不接收客户端年龄、接口或密钥。同owner同ID并发共用Promise，已保存ID直接返回；其他并发429，跨用户ID冲突409；未配置503，缺少生日/年龄不适用422，生成失败502、超时504。
- 年龄：6—8/9—10/11—12/13—15/16+段的语言、篇幅及数字范围约束。固定材料7—12岁可用且限制层次；缺失生日不能新开材料，原会话仍可恢复。个人生日/识别码/原始作答不送供应商。
- AI：服务器env配置兼容Chat Completions的JSON模式，地址/模型/密钥必填；每次编写+复核共2次调用，默认每调用6000 tokens、总超时90秒。三步以上选择题，数学结果经非eval四则解析器检查。source/ageProfile/model/fingerprint保存在原unit快照，段落指纹稳定，重复检查拒绝；未完成检查仍用原view遮蔽。
- 额度：每账号每分钟3次新尝试（进程内），同一时间1份；默认每日20个AI会话（原数据库、管理员时区），失败尝试不落会话但供应商仍可能计费。无新增依赖或数据库表。
- 验证：54项Node测试，含模拟供应商完整链路、年龄与权限、防泄露/失败/并发/额度/报告来源分组。浏览器以10岁UI夹具核对三模块样式。未接真实付费服务，未完成本轮实体手机测试。
- 使用与运维：`docs/AGE_AI_LEARNING.md`。AI内容仍可能错误，复核不是标准化审定；正式题目质量需家庭反馈及持续修订。
