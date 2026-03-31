/**
 * 行程规划类型定义
 * 参考高德路径规划，支持多段行程拆分
 */

// =============================================
// 基础类型
// =============================================

/** 坐标点 */
export interface Coordinate {
  latitude: number
  longitude: number
}

/** 地点信息 */
export interface Location {
  name: string
  address?: string
  coordinate?: Coordinate
  type?: 'airport' | 'train_station' | 'hotel' | 'office' | 'home' | 'poi'
}

/** 交通方式 */
export type TransportMode = 'taxi' | 'train' | 'flight' | 'walking' | 'subway' | 'bus'

// =============================================
// 行程规划请求
// =============================================

/** 行程规划请求 */
export interface TripPlanRequest {
  /** 出发地 */
  origin: Location
  /** 目的地 */
  destination: Location
  /** 出发时间（可选，默认立即出发） */
  departureTime?: Date
  /** 到达时间（可选） */
  arrivalTime?: Date
  /** 期望交通方式（可选） */
  preferredMode?: TransportMode
  /** 用户位置（用于智能选择起点） */
  userLocation?: Coordinate
  /** 是否需要返程 */
  needReturn?: boolean
  /** 额外要求 */
  notes?: string
}

// =============================================
// 高德路径规划结果
// =============================================

/** 路径段 */
export interface RouteSegment {
  /** 交通方式 */
  mode: TransportMode
  /** 起点 */
  origin: Location
  /** 终点 */
  destination: Location
  /** 距离（米） */
  distance: number
  /** 时长（秒） */
  duration: number
  /** 费用（元，可选） */
  cost?: number
  /** 详细步骤（可选） */
  steps?: RouteStep[]
  /** 线路编码（可选） */
  polyline?: Coordinate[]
}

/** 路径步骤 */
export interface RouteStep {
  instruction: string
  distance: number
  duration: number
  roadName?: string
}

/** 完整路径规划 */
export interface RoutePlan {
  /** 方案 ID */
  id: string
  /** 方案名称 */
  name: string
  /** 总距离（米） */
  totalDistance: number
  /** 总时长（秒） */
  totalDuration: number
  /** 总费用（元） */
  totalCost?: number
  /** 路径段列表 */
  segments: RouteSegment[]
  /** 方案优势说明 */
  highlights?: string[]
}

// =============================================
// 行程拆分结果
// =============================================

/** 拆分出的任务 */
export interface SplitTask {
  /** 任务标题 */
  title: string
  /** 任务类型 */
  type: 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo'
  /** 计划时间 */
  scheduledTime: Date
  /** 结束时间（可选） */
  endTime?: Date
  /** 起点 */
  origin?: Location
  /** 终点 */
  destination?: Location
  /** 元数据 */
  metadata?: {
    distance?: number
    duration?: number
    cost?: number
    flightNo?: string
    trainNo?: string
    polyline?: Coordinate[]
  }
  /** 说明 */
  description?: string
}

/** 行程规划结果 */
export interface TripPlanResult {
  /** 是否成功 */
  success: boolean
  /** 路径方案列表 */
  routes: RoutePlan[]
  /** 推荐方案索引 */
  recommendedIndex: number
  /** 拆分的任务列表 */
  splitTasks: SplitTask[]
  /** 规划说明 */
  summary: string
  /** AI 思考过程 */
  reasoning: string[]
  /** 错误信息（如有） */
  error?: string
}

// =============================================
// Agent 思考过程类型
// =============================================

/** 思考步骤 */
export interface ReasoningStep {
  /** 步骤类型 */
  type: 'analyze' | 'query' | 'plan' | 'split' | 'optimize' | 'conclude'
  /** 步骤描述 */
  content: string
  /** 涉及的数据（可选） */
  data?: any
}

/** Agent 状态 */
export interface AgentState {
  /** 当前阶段 */
  phase: 'idle' | 'analyzing' | 'querying_map' | 'planning_route' | 'splitting_tasks' | 'done'
  /** 当前思考 */
  currentThought?: string
  /** 已完成的步骤 */
  completedSteps: ReasoningStep[]
}

// =============================================
// 高德 API 响应类型
// =============================================

/** 高德驾车规划响应 */
export interface AmapDrivingResponse {
  status: string
  info: string
  route: {
    paths: Array<{
      distance: string
      duration: string
      tolls: string
      steps: Array<{
        instruction: string
        road: string
        distance: string
        duration: string
        polyline: string
      }>
    }>
  }
}

/** 高德公交规划响应 */
export interface AmapTransitResponse {
  status: string
  info: string
  route: {
    transits: Array<{
      cost: string
      duration: string
      distance: string
      segments: Array<{
        bus?: {
          buslines: Array<{
            name: string
            departure_stop: { name: string }
            arrival_stop: { name: string }
            polyline: string
          }>
        }
        walking?: {
          distance: string
          duration: string
          polyline: string
        }
      }>
    }>
  }
}
