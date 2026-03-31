-- =============================================
-- AI Agent 任务系统数据库完整导出
-- 生成时间: 2024-01-15
-- 数据库: PostgreSQL (Supabase)
-- =============================================

-- 1. 位置缓存表
-- 用于缓存地理位置和路线信息，减少 API 调用
CREATE TABLE IF NOT EXISTS location_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 位置名称（唯一键）
  name VARCHAR(500) UNIQUE NOT NULL,
  
  -- 地址信息
  address TEXT,
  latitude VARCHAR(50) NOT NULL,
  longitude VARCHAR(50) NOT NULL,
  
  -- 行政区划
  city VARCHAR(100),
  province VARCHAR(100),
  
  -- 数据来源
  source VARCHAR(50) DEFAULT 'api',
  
  -- 路线数据（polyline 编码）
  polyline TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_cache_name ON location_cache(name);
CREATE INDEX IF NOT EXISTS idx_location_cache_city ON location_cache(city);
CREATE INDEX IF NOT EXISTS idx_location_cache_source ON location_cache(source);

COMMENT ON TABLE location_cache IS '地理位置缓存表，存储 POI 和路线信息';
COMMENT ON COLUMN location_cache.polyline IS '编码后的路线坐标点，用于地图绘制';
COMMENT ON COLUMN location_cache.source IS '数据来源: api, polyline, default';

-- 2. 推荐表
-- 存储用户个性化推荐内容
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL DEFAULT 'default-user',
  
  -- 推荐类型
  type VARCHAR(50) NOT NULL, -- restaurant, cafe, hotel, attraction, etc.
  
  -- 基本信息
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- 详细信息
  rating VARCHAR(10),
  distance VARCHAR(50),
  price VARCHAR(50),
  tags TEXT[],
  
  -- 位置信息
  location_name VARCHAR(500),
  location_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- 收藏状态
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- 元数据
  metadata JSONB DEFAULT '{}',
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);
CREATE INDEX IF NOT EXISTS idx_recommendations_is_favorite ON recommendations(is_favorite);

COMMENT ON TABLE recommendations IS '个性化推荐表';
COMMENT ON COLUMN recommendations.type IS '推荐类型: restaurant, cafe, hotel, attraction';

-- 3. 任务表（统一模型）
-- 所有类型的任务/日程统一存储
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
  
  -- 起点/位置
  location_name VARCHAR(500),
  location_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- 终点（用于出行类）
  destination_name VARCHAR(500),
  destination_address TEXT,
  dest_latitude DECIMAL(10, 8),
  dest_longitude DECIMAL(11, 8),
  
  -- 类型特定数据（JSONB）
  metadata JSONB DEFAULT '{}',
  
  -- 过期标记（自动计算或手动设置）
  is_expired BOOLEAN DEFAULT FALSE,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 约束
  CONSTRAINT valid_type CHECK (type IN ('taxi', 'train', 'flight', 'meeting', 'dining', 'todo', 'hotel', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'expired'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_time ON tasks(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_tasks_is_expired ON tasks(is_expired);

COMMENT ON TABLE tasks IS '统一任务表，存储所有类型的日程和出行任务';
COMMENT ON COLUMN tasks.type IS '任务类型: taxi, train, flight, meeting, dining, todo, hotel, other';
COMMENT ON COLUMN tasks.status IS '任务状态: pending, confirmed, in_progress, completed, cancelled, expired';
COMMENT ON COLUMN tasks.metadata IS '类型特定的扩展数据，JSON 格式';

-- 4. 任务事件表（记录所有操作）
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

COMMENT ON TABLE task_events IS '任务事件日志表，记录任务的创建、更新、状态变更等操作';

-- 5. 工具调用日志表
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
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);

COMMENT ON TABLE tool_calls IS 'AI 工具调用日志表';

-- 6. 对话表（保留聊天记录）
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL DEFAULT 'default-user',
  
  -- 对话元数据
  title VARCHAR(255),
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

COMMENT ON TABLE conversations IS '对话会话表';

-- 7. 消息表
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

COMMENT ON TABLE messages IS '对话消息表';
COMMENT ON COLUMN messages.role IS '消息角色: user, assistant, tool';

-- =============================================
-- 触发器：自动更新 updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要自动更新的表创建触发器
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

-- =============================================
-- 示例数据（可选）
-- =============================================

-- INSERT INTO location_cache (name, address, latitude, longitude, city, province, source)
-- VALUES 
--   ('杭州西湖', '浙江省杭州市西湖区', '30.242489', '120.148532', '杭州', '浙江', 'default'),
--   ('北京天安门', '北京市东城区东长安街', '39.904202', '116.390252', '北京', '北京', 'api');

-- INSERT INTO recommendations (user_id, type, title, description, rating, distance, price, tags, is_favorite)
-- VALUES 
--   ('default-user', 'restaurant', '粤式茶餐厅', '地道粤式茶点，环境优雅', '4.5', '500m', '¥58/人', ARRAY['粤菜', '茶点'], false),
--   ('default-user', 'cafe', '星巴克咖啡', '经典咖啡品牌，环境舒适', '4.2', '300m', '¥35/人', ARRAY['咖啡', '西式'], true);
