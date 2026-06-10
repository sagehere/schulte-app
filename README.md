# 舒尔特方格专注力训练应用

Docker 部署版本 - 基于 Node.js + Express + SQLite

## 快速部署

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置以下变量：

- `ADMIN_PASSWORD` - 管理员密码（必填）
- `USER_CREATE_CODE` - 用户创建授权码（必填）
- `TELEGRAM_BOT_TOKEN` - Telegram Bot Token（可选）

### 2. 使用 Docker Compose 启动

```bash
docker-compose up -d
```

### 3. 访问应用

- 主页：http://your-server:3000
- 健康检查：http://your-server:3000/health
- 用户公开页：http://your-server:3000/u/{identifier}

## 手动部署

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 3. 启动应用

```bash
npm start
```

## API 接口

### 用户相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/users | 创建用户 |
| GET | /api/users/:id | 获取用户信息 |
| PUT | /api/users/:id | 更新用户信息 |
| DELETE | /api/users/:id | 删除用户 |
| POST | /api/users/:id/login | 用户登录 |
| POST | /api/users/:id/records | 保存训练记录 |
| GET | /api/users/:id/public | 获取公开信息 |

### 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/users | 列出所有用户 |
| GET | /api/admin/users/:id | 获取用户详情 |
| POST | /api/admin/users/:id/password | 重置密码 |
| DELETE | /api/admin/users/:id | 删除用户 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/send-daily-report | 发送 Telegram 简报 |
| GET | /health | 健康检查 |

## 数据持久化

SQLite 数据库文件保存在 `data/schulte.db`，Docker 部署时会挂载 `./data` 目录。

## 备份

备份 `data` 目录即可保存所有数据。

## 更新

```bash
docker-compose down
docker-compose build
docker-compose up -d
```
