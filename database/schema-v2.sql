-- =============================================
-- AI Agent 任务系统数据库设计
-- =============================================

-- 1. 任务表（统一模型）
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL DEFAULT 'default-user',
  
  -- 基础信息
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- 类型：taxi, train, flight, meeting, dining, todo, hotel
  type VARCHAR(50) NOT NULL,
  
  -- 状态：pending, confirmed, in_progress, completed, cancelled, expired
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- 时间
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  
  -- 位置
  location_name VARCHAR(500),
  location_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- 目的地（用于出行类）
  destination_name VARCHAR(500),
  destination_address TEXT,
  dest_latitude DECIMAL(10, 8),
  dest_longitude DECIMAL(11, 8),
  
  -- 类型特定数据（JSONB）
  metadata JSONB DEFAULT '{}',
  
  -- 过期标记（自动计算）
  is_expired BOOLEAN DEFAULT FALSE,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 索引字段
  CONSTRAINT valid_type CHECK (type IN ('taxi', 'train', 'flight', 'meeting', 'dining', 'todo', 'hotel', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'expired'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_time ON tasks(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_tasks_is_expired ON tasks(is_expired);

-- 2. 任务事件表（记录所有操作）
CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL DEFAULT 'default-user',
  
  -- 事件类型
  event_type VARCHAR(50) NOT NULL, -- created, updated, status_changed, cancelled, completed, expired
  
  -- 变更内容
  changes JSONB DEFAULT '{}',
  
  -- AI 工具调用信息
  tool_name VARCHAR(100),
  tool_call_id VARCHAR(255),
  reasoning TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_event_type CHECK (event_type IN ('created', 'updated', 'status_changed', 'cancelled', 'completed', 'expired', 'tool_called'))
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_user_id ON task_events(user_id);

-- 3. 工具调用日志表
CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL DEFAULT 'default-user',
  conversation_id VARCHAR(255),
  
  -- 工具信息
  tool_name VARCHAR(100) NOT NULL,
  tool_args JSONB NOT NULL,
  tool_result JSONB,
  
  -- 执行状态
  status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
  error_message TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_user_id ON tool_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation_id ON tool_calls(conversation_id);

-- 4. 对话表（保留聊天记录）
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL DEFAULT 'default-user',
  
  -- 对话元数据
  title VARCHAR(255),
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 消息表
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL DEFAULT 'default-user',
  
  -- 角色
  role VARCHAR(50) NOT NULL, -- user, assistant, tool
  
  -- 内容
  content TEXT,
  
  -- AI 思考过程
  reasoning TEXT,
  
  -- 工具调用
  tool_calls JSONB,
  tool_call_id VARCHAR(255),
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'tool'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- =============================================
-- metadata 字段示例
-- =============================================

-- 打车 (taxi)
-- {
--   "driver_name": "张师傅",
--   "driver_phone": "138****8888",
--   "car_number": "京A·88888",
--   "car_model": "大众帕萨特",
--   "arrive_minutes": 3,
--   "estimated_cost": 35,
--   "actual_cost": null,
--   "order_id": "taxi_123456"
-- }

-- 火车 (train)
-- {
--   "train_number": "G123",
--   "seat_type": "二等座",
--   "seat_number": "12A",
--   "carriage": "5",
--   "platform": "3",
--   "cost": 553,
--   "duration_minutes": 280,
--   "tip": "请提前30分钟到站"
-- }

-- 飞机 (flight)
-- {
--   "flight_number": "MU5678",
--   "seat_type": "经济舱",
--   "seat_number": "23F",
--   "gate": "A12",
--   "cost": 890,
--   "duration_minutes": 150,
--   "tip": "请提前90分钟到机场"
-- }

-- 会议 (meeting)
-- {
--   "attendees": ["张三", "李四", "王五"],
--   "meeting_room": "3楼会议室A",
--   "meeting_link": "https://zoom.us/xxx",
--   "agenda": "项目进度汇报",
--   "reminder_minutes": 15
-- }

-- 餐饮 (dining)
-- {
--   "restaurant_name": "老北京涮羊肉",
--   "restaurant_address": "朝阳区xxx",
--   "guest_count": 4,
--   "reservation_time": "18:00",
--   "contact_phone": "010-xxxx",
--   "cost_per_person": 120
-- }

-- 酒店 (hotel)
-- {
--   "hotel_name": "北京王府井希尔顿酒店",
--   "hotel_address": "东城区王府井xxx",
--   "room_type": "大床房",
--   "check_in_date": "2024-01-15",
--   "check_out_date": "2024-01-16",
--   "cost_per_night": 1288,
--   "order_id": "hotel_123456"
-- }

-- 事务 (todo)
-- {
--   "priority": "high",
--   "category": "work",
--   "reminder_time": "2024-01-15T09:00:00Z",
--   "notes": "记得带上文件"
-- }
