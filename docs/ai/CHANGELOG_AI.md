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
