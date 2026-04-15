# 数据库结构对比报告

生成时间：2026-04-14
对比文件：database/schema-v2.sql

## 一、表结构对比

### 1.1 表数量对比

| 项目 | 数量 | 表列表 |
|------|------|--------|
| SQL 文件定义 | 7 张 | location_cache, recommendations, tasks, task_events, tool_calls, conversations, messages |
| 实际数据库 | 8 张 | 多了 `health_check` 表（健康检查，非业务表） |

**结论：** ✅ 基本一致，多了一个健康检查表（不影响业务）

---

## 二、字段类型差异

### 2.1 关键差异 ❌

#### recommendations 表 - 经纬度字段

| 字段 | SQL 文件定义 | 实际数据库 | 状态 |
|------|-------------|-----------|------|
| latitude | DECIMAL(10, 8) | TEXT | ❌ 不一致 |
| longitude | DECIMAL(11, 8) | TEXT | ❌ 不一致 |

#### tasks 表 - 经纬度字段

| 字段 | SQL 文件定义 | 实际数据库 | 状态 |
|------|-------------|-----------|------|
| latitude | DECIMAL(10, 8) | TEXT | ❌ 不一致 |
| longitude | DECIMAL(11, 8) | TEXT | ❌ 不一致 |
| dest_latitude | DECIMAL(10, 8) | TEXT | ❌ 不一致 |
| dest_longitude | DECIMAL(11, 8) | TEXT | ❌ 不一致 |

**影响：**
- 精度损失：TEXT 类型无法保证数值精度
- 性能影响：无法进行数值计算和比较
- 类型不安全：无法利用数据库的数值约束

---

## 三、约束差异

### 3.1 缺失的 CHECK 约束 ❌

#### tasks 表

| 约束名称 | SQL 文件定义 | 实际数据库 | 状态 |
|----------|-------------|-----------|------|
| valid_type | CHECK (type IN ('taxi', 'train', 'flight', 'meeting', 'dining', 'todo', 'hotel', 'other')) | 无 | ❌ 缺失 |
| valid_status | CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'expired')) | 无 | ❌ 缺失 |

#### task_events 表

| 约束名称 | SQL 文件定义 | 实际数据库 | 状态 |
|----------|-------------|-----------|------|
| valid_event_type | CHECK (event_type IN ('created', 'updated', 'status_changed', 'cancelled', 'completed', 'expired', 'tool_called')) | 无 | ❌ 缺失 |

#### messages 表

| 约束名称 | SQL 文件定义 | 实际数据库 | 状态 |
|----------|-------------|-----------|------|
| valid_role | CHECK (role IN ('user', 'assistant', 'tool')) | 无 | ❌ 缺失 |

**影响：**
- 数据完整性无法保证
- 可能插入非法类型的数据
- 应用层需要额外的校验逻辑

---

## 四、触发器差异

### 4.1 缺失的触发器 ❌

SQL 文件中定义了以下触发器，但实际数据库中都不存在：

| 触发器名称 | 作用 | 状态 |
|-----------|------|------|
| update_location_cache_updated_at | 自动更新 location_cache.updated_at | ❌ 缺失 |
| update_recommendations_updated_at | 自动更新 recommendations.updated_at | ❌ 缺失 |
| update_tasks_updated_at | 自动更新 tasks.updated_at | ❌ 缺失 |
| update_conversations_updated_at | 自动更新 conversations.updated_at | ❌ 缺失 |

**缺失的函数：**
- `update_updated_at_column()` - 触发器调用的函数

**影响：**
- updated_at 字段不会自动更新
- 需要应用层手动更新
- 可能导致时间戳不准确

---

## 五、索引对比

### 5.1 索引一致性 ✅

所有 SQL 文件中定义的索引都已创建：

| 表名 | 索引名 | 状态 |
|------|--------|------|
| location_cache | idx_location_cache_name | ✅ 存在 |
| location_cache | idx_location_cache_city | ✅ 存在 |
| location_cache | idx_location_cache_source | ✅ 存在 |
| recommendations | idx_recommendations_user_id | ✅ 存在 |
| recommendations | idx_recommendations_type | ✅ 存在 |
| recommendations | idx_recommendations_is_favorite | ✅ 存在 |
| tasks | idx_tasks_user_id | ✅ 存在 |
| tasks | idx_tasks_type | ✅ 存在 |
| tasks | idx_tasks_status | ✅ 存在 |
| tasks | idx_tasks_scheduled_time | ✅ 存在 |
| tasks | idx_tasks_is_expired | ✅ 存在 |
| task_events | idx_task_events_task_id | ✅ 存在 |
| task_events | idx_task_events_user_id | ✅ 存在 |
| tool_calls | idx_tool_calls_user_id | ✅ 存在 |
| tool_calls | idx_tool_calls_conversation_id | ✅ 存在 |
| tool_calls | idx_tool_calls_tool_name | ✅ 存在 |
| conversations | idx_conversations_user_id | ✅ 存在 |
| messages | idx_messages_conversation_id | ✅ 存在 |
| messages | idx_messages_user_id | ✅ 存在 |

**结论：** ✅ 所有索引都已正确创建

---

## 六、外键对比

### 6.1 外键一致性 ✅

| 表名 | 外键 | 引用表 | 状态 |
|------|------|--------|------|
| messages | messages_conversation_id_conversations_id_fk | conversations(id) | ✅ 存在 |
| task_events | task_events_task_id_tasks_id_fk | tasks(id) | ✅ 存在 |

**结论：** ✅ 外键关系正确

---

## 七、总结

### 7.1 一致性评估

| 项目 | 状态 | 说明 |
|------|------|------|
| 表结构 | ✅ 基本一致 | 多了一个 health_check 表（无关紧要） |
| 索引 | ✅ 完全一致 | 所有索引都已创建 |
| 外键 | ✅ 完全一致 | 外键关系正确 |
| 字段类型 | ❌ 部分不一致 | 经纬度字段类型不匹配 |
| CHECK 约束 | ❌ 全部缺失 | 缺少 4 个 CHECK 约束 |
| 触发器 | ❌ 全部缺失 | 缺少 4 个触发器和 1 个函数 |

### 7.2 风险评估

**高风险：**
- ❌ 缺少 CHECK 约束，可能导致非法数据
- ❌ 经纬度字段类型不匹配，影响精度和性能

**中风险：**
- ❌ 缺少触发器，需要应用层手动更新时间戳

**低风险：**
- ✅ 多了一个 health_check 表（不影响业务）

### 7.3 建议修复方案

#### 方案 1：修改数据库（推荐）

```sql
-- 1. 添加 update_updated_at_column 函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 修改经纬度字段类型
ALTER TABLE recommendations
  ALTER COLUMN latitude TYPE DECIMAL(10, 8) USING latitude::DECIMAL(10, 8),
  ALTER COLUMN longitude TYPE DECIMAL(11, 8) USING longitude::DECIMAL(11, 8);

ALTER TABLE tasks
  ALTER COLUMN latitude TYPE DECIMAL(10, 8) USING latitude::DECIMAL(10, 8),
  ALTER COLUMN longitude TYPE DECIMAL(11, 8) USING longitude::DECIMAL(11, 8),
  ALTER COLUMN dest_latitude TYPE DECIMAL(10, 8) USING dest_latitude::DECIMAL(10, 8),
  ALTER COLUMN dest_longitude TYPE DECIMAL(11, 8) USING dest_longitude::DECIMAL(11, 8);

-- 3. 添加 CHECK 约束
ALTER TABLE tasks
  ADD CONSTRAINT valid_type CHECK (type IN ('taxi', 'train', 'flight', 'meeting', 'dining', 'todo', 'hotel', 'other')),
  ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'expired'));

ALTER TABLE task_events
  ADD CONSTRAINT valid_event_type CHECK (event_type IN ('created', 'updated', 'status_changed', 'cancelled', 'completed', 'expired', 'tool_called'));

ALTER TABLE messages
  ADD CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'tool'));

-- 4. 添加触发器
CREATE TRIGGER update_location_cache_updated_at
  BEFORE UPDATE ON location_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommendations_updated_at
  BEFORE UPDATE ON recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 方案 2：更新 SQL 文件（不推荐）

将 SQL 文件修改为与实际数据库一致（不推荐，因为会降低数据质量）

### 7.4 执行建议

1. **先备份数据库**
2. **在测试环境执行方案 1**
3. **验证功能正常后，在生产环境执行**
4. **监控日志，确保无异常**

---

## 八、对比详情

### 8.1 完整字段对比表

见下方详细对比（略）
