import { pgTable, serial, timestamp, varchar, text, boolean, integer, jsonb, index, decimal } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 系统表 - 禁止删除或修改
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})

// 1. 位置缓存表
export const locationCache = pgTable(
	"location_cache",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 500 }).notNull().unique(),
		address: text("address"),
		latitude: varchar("latitude", { length: 50 }).notNull(),
		longitude: varchar("longitude", { length: 50 }).notNull(),
		city: varchar("city", { length: 100 }),
		province: varchar("province", { length: 100 }),
		source: varchar("source", { length: 50 }).default('api'),
		polyline: text("polyline"),
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_location_cache_name").on(table.name),
		index("idx_location_cache_city").on(table.city),
		index("idx_location_cache_source").on(table.source),
	]
)

// 2. 推荐表
export const recommendations = pgTable(
	"recommendations",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 255 }).notNull().default('default-user'),
		type: varchar("type", { length: 50 }).notNull(),
		title: varchar("title", { length: 500 }).notNull(),
		description: text("description"),
		rating: varchar("rating", { length: 10 }),
		distance: varchar("distance", { length: 50 }),
		price: varchar("price", { length: 50 }),
		tags: text("tags").array(),
		location_name: varchar("location_name", { length: 500 }),
		location_address: text("location_address"),
		latitude: text("latitude"),
		longitude: text("longitude"),
		is_favorite: boolean("is_favorite").default(false),
		metadata: jsonb("metadata").default({}),
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_recommendations_user_id").on(table.user_id),
		index("idx_recommendations_type").on(table.type),
		index("idx_recommendations_is_favorite").on(table.is_favorite),
	]
)

// 3. 任务表（统一模型）
export const tasks = pgTable(
	"tasks",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 255 }).notNull().default('default-user'),
		title: varchar("title", { length: 500 }).notNull(),
		description: text("description"),
		type: varchar("type", { length: 50 }).notNull(),
		status: varchar("status", { length: 50 }).notNull().default('pending'),
		scheduled_time: timestamp("scheduled_time", { withTimezone: true, mode: 'string' }).notNull(),
		end_time: timestamp("end_time", { withTimezone: true, mode: 'string' }),
		duration_minutes: integer("duration_minutes"),
		location_name: varchar("location_name", { length: 500 }),
		location_address: text("location_address"),
		latitude: text("latitude"),
		longitude: text("longitude"),
		destination_name: varchar("destination_name", { length: 500 }),
		destination_address: text("destination_address"),
		dest_latitude: text("dest_latitude"),
		dest_longitude: text("dest_longitude"),
		metadata: jsonb("metadata").default({}),
		is_expired: boolean("is_expired").default(false),
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		completed_at: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("idx_tasks_user_id").on(table.user_id),
		index("idx_tasks_type").on(table.type),
		index("idx_tasks_status").on(table.status),
		index("idx_tasks_scheduled_time").on(table.scheduled_time),
		index("idx_tasks_is_expired").on(table.is_expired),
	]
)

// 4. 任务事件表（记录所有操作）
export const taskEvents = pgTable(
	"task_events",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		task_id: varchar("task_id", { length: 36 }).notNull().references(() => tasks.id, { onDelete: "cascade" }),
		user_id: varchar("user_id", { length: 255 }).notNull().default('default-user'),
		event_type: varchar("event_type", { length: 50 }).notNull(),
		changes: jsonb("changes").default({}),
		tool_name: varchar("tool_name", { length: 100 }),
		tool_call_id: varchar("tool_call_id", { length: 255 }),
		reasoning: text("reasoning"),
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_task_events_task_id").on(table.task_id),
		index("idx_task_events_user_id").on(table.user_id),
	]
)

// 5. 工具调用日志表
export const toolCalls = pgTable(
	"tool_calls",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 255 }).notNull().default('default-user'),
		conversation_id: varchar("conversation_id", { length: 255 }),
		tool_name: varchar("tool_name", { length: 100 }).notNull(),
		tool_args: jsonb("tool_args").notNull(),
		tool_result: jsonb("tool_result"),
		status: varchar("status", { length: 50 }).default('pending'),
		error_message: text("error_message"),
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		executed_at: timestamp("executed_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("idx_tool_calls_user_id").on(table.user_id),
		index("idx_tool_calls_conversation_id").on(table.conversation_id),
		index("idx_tool_calls_tool_name").on(table.tool_name),
	]
)

// 6. 对话表（保留聊天记录）
export const conversations = pgTable(
	"conversations",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 255 }).notNull().default('default-user'),
		title: varchar("title", { length: 255 }),
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_conversations_user_id").on(table.user_id),
	]
)

// 7. 消息表
export const messages = pgTable(
	"messages",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		conversation_id: varchar("conversation_id", { length: 36 }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
		user_id: varchar("user_id", { length: 255 }).notNull().default('default-user'),
		role: varchar("role", { length: 50 }).notNull(),
		content: text("content"),
		reasoning: text("reasoning"),
		tool_calls: jsonb("tool_calls"),
		tool_call_id: varchar("tool_call_id", { length: 255 }),
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_messages_conversation_id").on(table.conversation_id),
		index("idx_messages_user_id").on(table.user_id),
	]
)
