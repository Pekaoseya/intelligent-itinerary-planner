import { pgTable, serial, timestamp, varchar, text, boolean, integer, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 系统表 - 禁止删除或修改
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})

// 用户表
export const users = pgTable(
	"users",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		nickname: varchar("nickname", { length: 100 }),
		avatar: text("avatar"),
		phone: varchar("phone", { length: 20 }),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("users_phone_idx").on(table.phone),
	]
)

// 日程表
export const schedules = pgTable(
	"schedules",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull(),
		title: varchar("title", { length: 200 }).notNull(),
		description: text("description"),
		startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }).notNull(),
		endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
		location: varchar("location", { length: 200 }),
		latitude: varchar("latitude", { length: 50 }),
		longitude: varchar("longitude", { length: 50 }),
		type: varchar("type", { length: 20 }).default("general").notNull(), // general, meeting, travel, dining
		status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, completed, cancelled
		reminder: boolean("reminder").default(false),
		reminderTime: timestamp("reminder_time", { withTimezone: true, mode: 'string' }),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("schedules_user_id_idx").on(table.userId),
		index("schedules_start_time_idx").on(table.startTime),
		index("schedules_status_idx").on(table.status),
	]
)

// 出行记录表
export const trips = pgTable(
	"trips",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull(),
		title: varchar("title", { length: 200 }).notNull(),
		origin: varchar("origin", { length: 200 }).notNull(),
		destination: varchar("destination", { length: 200 }).notNull(),
		departureTime: timestamp("departure_time", { withTimezone: true, mode: 'string' }).notNull(),
		arrivalTime: timestamp("arrival_time", { withTimezone: true, mode: 'string' }),
		status: varchar("status", { length: 20 }).default("planned").notNull(), // planned, ongoing, completed, cancelled
		estimatedCost: integer("estimated_cost"),
		actualCost: integer("actual_cost"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("trips_user_id_idx").on(table.userId),
		index("trips_departure_time_idx").on(table.departureTime),
		index("trips_status_idx").on(table.status),
	]
)

// 出行节点表
export const tripNodes = pgTable(
	"trip_nodes",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		tripId: varchar("trip_id", { length: 36 }).notNull(),
		type: varchar("type", { length: 30 }).notNull(), // taxi, flight, train, bus, hotel, attraction, dining
		name: varchar("name", { length: 200 }).notNull(),
		location: varchar("location", { length: 200 }),
		latitude: varchar("latitude", { length: 50 }),
		longitude: varchar("longitude", { length: 50 }),
		scheduledTime: timestamp("scheduled_time", { withTimezone: true, mode: 'string' }),
		duration: integer("duration"), // 分钟
		cost: integer("cost"),
		bookingReference: varchar("booking_reference", { length: 100 }),
		bookingStatus: varchar("booking_status", { length: 20 }).default("pending"), // pending, confirmed, cancelled
		notes: text("notes"),
		order: integer("order").notNull().default(0),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("trip_nodes_trip_id_idx").on(table.tripId),
		index("trip_nodes_type_idx").on(table.type),
	]
)

// 推荐表
export const recommendations = pgTable(
	"recommendations",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull(),
		type: varchar("type", { length: 30 }).notNull(), // restaurant, cafe, attraction, hotel
		title: varchar("title", { length: 200 }).notNull(),
		description: text("description"),
		imageUrl: text("image_url"),
		location: varchar("location", { length: 200 }),
		latitude: varchar("latitude", { length: 50 }),
		longitude: varchar("longitude", { length: 50 }),
		rating: varchar("rating", { length: 10 }),
		price: varchar("price", { length: 50 }),
		distance: varchar("distance", { length: 50 }),
		tags: jsonb("tags"), // string[]
		openingHours: text("opening_hours"),
		contactInfo: varchar("contact_info", { length: 100 }),
		isFavorite: boolean("is_favorite").default(false),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("recommendations_user_id_idx").on(table.userId),
		index("recommendations_type_idx").on(table.type),
	]
)

// 聊天记录表
export const chatMessages = pgTable(
	"chat_messages",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull(),
		role: varchar("role", { length: 20 }).notNull(), // user, assistant
		content: text("content").notNull(),
		intent: varchar("intent", { length: 50 }), // add_schedule, query_schedule, plan_trip, get_recommendation
		extractedData: jsonb("extracted_data"), // 提取的结构化数据
		relatedScheduleId: varchar("related_schedule_id", { length: 36 }),
		relatedTripId: varchar("related_trip_id", { length: 36 }),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("chat_messages_user_id_idx").on(table.userId),
		index("chat_messages_created_at_idx").on(table.createdAt),
	]
)

// Zod schemas
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
	coerce: { date: true },
})

// 用户相关
export const insertUserSchema = createCoercedInsertSchema(users).pick({
	nickname: true,
	avatar: true,
	phone: true,
})

export type User = typeof users.$inferSelect
export type InsertUser = z.infer<typeof insertUserSchema>

// 日程相关
export const insertScheduleSchema = createCoercedInsertSchema(schedules).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

export const updateScheduleSchema = createCoercedInsertSchema(schedules)
	.omit({
		id: true,
		userId: true,
		createdAt: true,
	})
	.partial()

export type Schedule = typeof schedules.$inferSelect
export type InsertSchedule = z.infer<typeof insertScheduleSchema>
export type UpdateSchedule = z.infer<typeof updateScheduleSchema>

// 出行相关
export const insertTripSchema = createCoercedInsertSchema(trips).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

export const insertTripNodeSchema = createCoercedInsertSchema(tripNodes).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

export type Trip = typeof trips.$inferSelect
export type InsertTrip = z.infer<typeof insertTripSchema>
export type TripNode = typeof tripNodes.$inferSelect
export type InsertTripNode = z.infer<typeof insertTripNodeSchema>

// 推荐相关
export const insertRecommendationSchema = createCoercedInsertSchema(recommendations).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

export type Recommendation = typeof recommendations.$inferSelect
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>

// 聊天相关
export const insertChatMessageSchema = createCoercedInsertSchema(chatMessages).omit({
	id: true,
	createdAt: true,
})

export type ChatMessage = typeof chatMessages.$inferSelect
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>

// 位置缓存表
export const locationCache = pgTable(
	"location_cache",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 100 }).notNull(),
		address: varchar("address", { length: 255 }),
		latitude: varchar("latitude", { length: 20 }).notNull(),
		longitude: varchar("longitude", { length: 20 }).notNull(),
		city: varchar("city", { length: 50 }),
		province: varchar("province", { length: 50 }),
		source: varchar("source", { length: 20 }).default("api"),
		polyline: text("polyline"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("location_cache_name_idx").on(table.name),
		index("location_cache_city_idx").on(table.city),
	]
)

export const insertLocationCacheSchema = createCoercedInsertSchema(locationCache).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

export type LocationCache = typeof locationCache.$inferSelect
export type InsertLocationCache = z.infer<typeof insertLocationCacheSchema>
