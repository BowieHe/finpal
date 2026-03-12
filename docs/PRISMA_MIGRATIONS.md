# Prisma 迁移维护指南

## 概述

本项目使用 Prisma ORM 管理数据库架构。迁移文件保存在 `prisma/migrations/` 目录下，已纳入 Git 版本控制。

## 工作原理

```
开发阶段                          生产部署
─────────────────────────────────────────────────
修改 schema.prisma        →    docker-compose up
      ↓                              ↓
运行 migrate dev          →    自动执行 migrate deploy
      ↓                              ↓
生成迁移文件提交 git            表不存在？创建 ✓
                                  表已存在？跳过 ✓
```

## 常用命令

### 开发时 - 修改数据库结构

当你修改了 `prisma/schema.prisma` 文件后：

```bash
# 1. 确保数据库在运行
docker compose up -d postgres

# 2. 创建并应用迁移（交互式）
npx prisma migrate dev --name <描述>

# 示例：添加用户表
npx prisma migrate dev --name add_user_table
```

**这个命令会：**
- 生成新的迁移文件（`prisma/migrations/20240312xxxxxx_add_user_table/`）
- 应用到本地数据库
- 提示你输入迁移名称

### 生成 Prisma Client

修改 schema 后需要重新生成客户端类型：

```bash
npx prisma generate
```

### 查看数据库

```bash
# 打开 Prisma Studio（图形界面）
npx prisma studio

# 或查看 SQL
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

## 维护流程

### 每次修改数据库结构的步骤：

1. **修改 `prisma/schema.prisma`**
   ```prisma
   model NewTable {
     id   Int    @id @default(autoincrement())
     name String
   }
   ```

2. **创建迁移**
   ```bash
   npx prisma migrate dev --name add_new_table
   ```

3. **提交到 Git**
   ```bash
   git add prisma/migrations/
   git add prisma/schema.prisma
   git commit -m "feat: add new_table for xxx feature"
   ```

4. **推送代码**
   ```bash
   git push
   ```

## 生产部署

用户在新环境中运行：

```bash
docker compose up -d
```

**自动执行的流程：**
1. 启动 PostgreSQL
2. 运行 `prisma migrate deploy`（应用所有未应用的迁移）
3. 启动 Web 应用

### 命令对比

| 命令 | 作用 | 生成迁移文件 | 适用场景 |
|------|------|-------------|---------|
| `prisma migrate dev` | 生成迁移 + 应用到数据库 | ✅ 是 | 开发阶段 |
| `prisma migrate deploy` | 只应用已有迁移 | ❌ 否 | 生产部署 |
| `prisma db push` | 直接同步 schema（不推荐） | ❌ 否 | 快速原型 |
| `prisma migrate reset` | 重置数据库并重新应用迁移 | - | 开发调试 |

## 故障排除

### 1. "表已存在"错误

如果手动创建过表导致迁移失败：

```bash
# 标记迁移为已应用（不实际执行 SQL）
npx prisma migrate resolve --applied <迁移名称>
```

### 2. 迁移冲突

多个开发者同时添加迁移时：

```bash
# 1. 拉取最新代码
git pull

# 2. 重新生成客户端
npx prisma generate

# 3. 应用新迁移
npx prisma migrate deploy
```

### 3. 数据库状态不一致

如果数据库状态和迁移记录不一致：

```bash
# 查看当前数据库状态
npx prisma migrate status

# 重置并重新应用（⚠️ 会丢失数据）
npx prisma migrate reset
```

## 最佳实践

1. **每次修改 schema 都创建迁移**，不要累积多个修改
2. **迁移文件名要有意义**：`add_user_preferences` 比 `migration_1` 好
3. **提交前测试迁移**：确保迁移能在新数据库正常运行
4. **不要手动修改已应用的迁移文件**
5. **生产环境永远使用 `migrate deploy`**，不要用 `migrate dev` 或 `db push`

## 文件说明

```
prisma/
├── schema.prisma              # 数据库模型定义
├── migrations/
│   ├── migration_lock.toml    # 迁移锁定文件（不要修改）
│   └── 20250312000000_init/   # 迁移文件夹
│       └── migration.sql      # 实际 SQL 语句
```
