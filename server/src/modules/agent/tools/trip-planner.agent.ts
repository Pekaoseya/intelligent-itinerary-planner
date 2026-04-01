/**
 * 行程规划智能体
 * 
 * 使用 LLM 进行：
 * 1. 分析用户需求（理解自然语言时间）
 * 2. 决定调用哪些 API
 * 3. 分析结果并拆分任务
 * 
 * 不硬编码任何规则，全部由 AI 决策
 */

import { Injectable, Logger } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { queryLongDistanceTransit, type ParsedTransitPlan } from './amap-transit.service'
import {
  getAmapKey,
  getCoordinates,
  getDrivingRoute,
  calculateStraightDistance,
  extractCityName,
} from './map-utils'
import type { TripPlanRequest, TripPlanResult, RoutePlan, RouteSegment, SplitTask } from './trip-planner.types'

// =============================================
// LLM 响应类型
// =============================================

/** LLM 分析需求的输出 */
interface AnalysisOutput {
  /** 理解的出发时间（ISO 格式） */
  departureTime: string
  /** 理解的起点 */
  origin: {
    name: string
    city?: string
  }
  /** 理解的目的地 */
  destination: {
    name: string
    city?: string
  }
  /** 用户偏好 */
  preferences: {
    transportMode?: 'high_speed_rail' | 'flight' | 'taxi'
    timePreference?: 'morning' | 'afternoon' | 'evening'
  }
  /** 分析思路 */
  reasoning: string
}

/** LLM 拆分任务的输出 */
interface TaskSplitOutput {
  tasks: Array<{
    title: string
    type: 'taxi' | 'train' | 'flight' | 'todo'
    scheduledTime: string
    origin?: string
    destination?: string
    description: string
    metadata?: Record<string, any>
  }>
  summary: string
}

// =============================================
// 进度回调类型
// =============================================

export interface TripProgressEvent {
  type: 'reasoning' | 'tool_call' | 'result'
  step: string
  data?: any
}

export type TripProgressCallback = (event: TripProgressEvent) => void

// =============================================
// 智能体实现
// =============================================

@Injectable()
export class TripPlannerAgent {
  private readonly logger = new Logger(TripPlannerAgent.name)
  private llmClient: LLMClient

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  /**
   * 规划行程 - 主入口
   * 全流程由 LLM 驱动
   */
  async planTrip(
    request: TripPlanRequest,
    onProgress?: TripProgressCallback
  ): Promise<TripPlanResult> {
    const reasoning: string[] = []

    // 辅助函数：推送进度
    const pushProgress = (step: string, type: TripProgressEvent['type'] = 'reasoning', data?: any) => {
      reasoning.push(step)
      onProgress?.({ type, step, data })
    }

    try {
      // =============================================
      // Step 1: LLM 分析用户需求
      // =============================================
      pushProgress('🧠 AI 正在分析您的出行需求...')
      
      const analysis = await this.analyzeRequest(request)
      pushProgress(analysis.reasoning)

      // =============================================
      // Step 2: 获取坐标和城市信息
      // =============================================
      pushProgress('📍 正在获取地理信息...')
      
      const originCoord = request.origin.coordinate || await getCoordinates(request.origin.name)
      const destCoord = request.destination.coordinate || await getCoordinates(request.destination.name)
      
      const originCity = analysis.origin.city || extractCityName(request.origin.name)
      const destCity = analysis.destination.city || extractCityName(request.destination.name)
      
      const straightDistance = calculateStraightDistance(
        originCoord.latitude, originCoord.longitude,
        destCoord.latitude, destCoord.longitude
      )
      
      pushProgress(`📏 直线距离约 ${Math.round(straightDistance / 1000)} 公里`)

      // =============================================
      // Step 3: 调用高德 API
      // =============================================
      const routes: RoutePlan[] = []

      // 跨城交通
      if (originCity && destCity && originCity !== destCity) {
        pushProgress(`🚄 查询跨城交通：${originCity} → ${destCity}`, 'tool_call')
        
        const originStr = `${originCoord.longitude},${originCoord.latitude}`
        const destStr = `${destCoord.longitude},${destCoord.latitude}`
        
        const transitPlans = await queryLongDistanceTransit(originStr, destStr, originCity, destCity)
        
        if (transitPlans.length > 0) {
          pushProgress(`✅ 找到 ${transitPlans.length} 个出行方案`, 'result', { count: transitPlans.length })
          
          for (const plan of transitPlans.slice(0, 2)) {
            const route = this.convertPlanToRoute(plan)
            if (route) routes.push(route)
          }
        } else {
          pushProgress('⚠️ 未找到跨城交通方案')
        }
      }

      // 短距离驾车
      if (straightDistance < 500000 && routes.length === 0) {
        pushProgress('🚗 查询驾车路线...', 'tool_call')
        const drivingRoute = await getDrivingRoute(originCoord, destCoord)
        
        if (drivingRoute) {
          pushProgress('✅ 找到驾车方案', 'result')
          routes.push({
            id: 'taxi_direct',
            name: '打车直达',
            totalDistance: drivingRoute.distance,
            totalDuration: drivingRoute.duration,
            totalCost: Math.round(drivingRoute.distance * 0.003 + 10),
            segments: [{
              mode: 'taxi',
              origin: request.origin,
              destination: request.destination,
              distance: drivingRoute.distance,
              duration: drivingRoute.duration,
              cost: Math.round(drivingRoute.distance * 0.003 + 10),
              polyline: drivingRoute.polyline,
            }],
            highlights: ['门到门服务'],
          })
        }
      }

      // =============================================
      // Step 4: LLM 拆分任务
      // =============================================
      if (routes.length === 0) {
        return {
          success: false,
          routes: [],
          recommendedIndex: -1,
          splitTasks: [],
          summary: '未找到合适的出行方案',
          reasoning,
          error: '无法规划路线',
        }
      }

      pushProgress('📋 AI 正在拆分行程任务...')
      
      const selectedRoute = routes[0]
      const taskSplit = await this.splitTasksWithLLM(
        selectedRoute,
        analysis.departureTime,
        request
      )
      
      pushProgress(`✅ 已拆分为 ${taskSplit.tasks.length} 个任务`, 'result', { count: taskSplit.tasks.length })
      pushProgress(taskSplit.summary)

      // 转换为 SplitTask 格式
      const splitTasks: SplitTask[] = taskSplit.tasks.map((task, index) => ({
        title: task.title,
        type: task.type,
        scheduledTime: new Date(task.scheduledTime),
        origin: task.origin ? { name: task.origin } : undefined,
        destination: task.destination ? { name: task.destination } : undefined,
        metadata: task.metadata,
        description: task.description,
      }))

      return {
        success: true,
        routes,
        recommendedIndex: 0,
        splitTasks,
        summary: taskSplit.summary,
        reasoning,
      }
    } catch (error) {
      this.logger.error('行程规划失败:', error)
      pushProgress(`❌ 行程规划失败: ${error.message}`)
      return {
        success: false,
        routes: [],
        recommendedIndex: -1,
        splitTasks: [],
        summary: '行程规划失败',
        reasoning,
        error: error.message,
      }
    }
  }

  /**
   * LLM 分析用户需求
   * 理解自然语言时间、偏好等
   */
  private async analyzeRequest(request: TripPlanRequest): Promise<AnalysisOutput> {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 5)
    
    // 计算明天、后天
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    
    const dayAfter = new Date(now)
    dayAfter.setDate(dayAfter.getDate() + 2)
    const dayAfterStr = dayAfter.toISOString().split('T')[0]

    const systemPrompt = `你是一个出行需求分析专家。分析用户的出行需求，输出 JSON 格式的结果。

当前时间信息：
- 今天：${today}（${['周日','周一','周二','周三','周四','周五','周六'][now.getDay()]}）
- 当前时间：${currentTime}
- 明天：${tomorrowStr}
- 后天：${dayAfterStr}

用户位置：${request.origin.name}
目的地：${request.destination.name}
用户指定的出发时间：${request.departureTime ? (typeof request.departureTime === 'string' ? request.departureTime : new Date(request.departureTime).toISOString()) : '未指定'}
用户偏好交通方式：${request.preferredMode || '未指定'}

请分析并输出 JSON：
{
  "departureTime": "ISO 格式的时间，如 2026-04-02T14:00:00+08:00",
  "origin": { "name": "起点名称", "city": "城市名" },
  "destination": { "name": "终点名称", "city": "城市名" },
  "preferences": {
    "transportMode": "high_speed_rail 或 flight 或 taxi",
    "timePreference": "morning 或 afternoon 或 evening"
  },
  "reasoning": "你的分析思路，一句话说明"
}

注意：
1. 如果用户说"明天下午"，根据当前时间计算具体日期和时间
2. 提取起点和目的地所在的城市
3. 只输出 JSON，不要其他内容`

    const response = await this.llmClient.invoke(
      [{ role: 'user', content: systemPrompt }],
      { temperature: 0.1 }
    )

    // 解析 JSON
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('LLM 未返回有效 JSON')
    }

    return JSON.parse(jsonMatch[0]) as AnalysisOutput
  }

  /**
   * LLM 拆分任务
   * 根据路线和时间，智能拆分为具体任务
   */
  private async splitTasksWithLLM(
    route: RoutePlan,
    departureTime: string,
    request: TripPlanRequest
  ): Promise<TaskSplitOutput> {
    const systemPrompt = `你是一个行程规划专家。根据给定的路线信息，拆分为具体的出行任务。

路线信息：
- 方案名称：${route.name}
- 总距离：${Math.round(route.totalDistance / 1000)} 公里
- 总时长：${Math.round(route.totalDuration / 60)} 分钟
- 总费用：约 ${route.totalCost} 元

出发时间：${departureTime}

路径段：
${route.segments.map((seg, i) => 
  `${i + 1}. ${seg.mode === 'train' ? '高铁' : seg.mode === 'taxi' ? '打车' : seg.mode === 'flight' ? '飞机' : '步行'}：${seg.origin?.name || '起点'} → ${seg.destination?.name || '终点'}
   ${seg.trainNo ? `车次：${seg.trainNo}` : ''}
   ${seg.departureTime && seg.arrivalTime ? `时间：${seg.departureTime} - ${seg.arrivalTime}` : ''}
   ${seg.distance ? `距离：${Math.round(seg.distance / 1000)}km` : ''}
   ${seg.duration ? `时长：${Math.round(seg.duration / 60)}分钟` : ''}
`).join('\n')}

请拆分为任务，输出 JSON：
{
  "tasks": [
    {
      "title": "任务标题",
      "type": "taxi 或 train 或 flight 或 todo",
      "scheduledTime": "ISO 格式时间",
      "origin": "起点名称",
      "destination": "终点名称",
      "description": "任务说明",
      "metadata": {}
    }
  ],
  "summary": "行程总结，一句话"
}

注意事项：
1. 第一个任务的 scheduledTime 应该是出发时间
2. 后续任务的时间要根据前一个任务的时长计算
3. 高铁需要提前 30 分钟到站
4. 飞机需要提前 2 小时到机场
5. 只输出 JSON，不要其他内容`

    const response = await this.llmClient.invoke(
      [{ role: 'user', content: systemPrompt }],
      { temperature: 0.1 }
    )

    // 解析 JSON
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('LLM 未返回有效 JSON')
    }

    return JSON.parse(jsonMatch[0]) as TaskSplitOutput
  }

  /**
   * 转换高德方案为 RoutePlan
   */
  private convertPlanToRoute(plan: ParsedTransitPlan): RoutePlan | null {
    if (!plan.segments || plan.segments.length === 0) return null

    const segments: RouteSegment[] = plan.segments.map(seg => ({
      mode: (seg.type === 'railway' ? 'train' : seg.type === 'subway' ? 'taxi' : seg.type) as 'taxi' | 'train' | 'flight' | 'walking',
      origin: seg.origin,
      destination: seg.destination,
      distance: seg.distance,
      duration: seg.duration,
      cost: seg.cost,
      trainNo: seg.details?.trainNo,
      trainType: seg.details?.trainType,
      departureTime: seg.details?.departureTime,
      arrivalTime: seg.details?.arrivalTime,
      alternatives: seg.details?.alternatives,
    }))

    return {
      id: plan.id,
      name: plan.name,
      totalDistance: plan.totalDistance,
      totalDuration: plan.totalDuration,
      totalCost: plan.totalCost,
      segments,
      highlights: plan.highlights,
    }
  }
}

// =============================================
// 独立函数版本
// =============================================

let tripPlannerAgent: TripPlannerAgent | null = null

export function getTripPlannerAgent(): TripPlannerAgent {
  if (!tripPlannerAgent) {
    tripPlannerAgent = new TripPlannerAgent()
  }
  return tripPlannerAgent
}

/**
 * 使用智能体规划行程
 */
export async function planTripWithAgent(
  request: TripPlanRequest,
  onProgress?: TripProgressCallback
): Promise<TripPlanResult> {
  return getTripPlannerAgent().planTrip(request, onProgress)
}
