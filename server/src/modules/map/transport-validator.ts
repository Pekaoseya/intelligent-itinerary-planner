/**
 * 交通方式校验服务
 * 校验出行方式的合理性，提供智能建议和自动修正
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  AIRPORTS,
  TRAIN_STATIONS,
  findAirportByCity,
  findStationByCity,
  isAirport,
  isTrainStation,
  TRANSPORT_RULES,
  Airport,
  TrainStation,
} from './transport-nodes'

// 任务类型
export type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'

// 校验结果
export interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
  suggestions: string[]
  autoFix?: {
    origin?: { name: string; latitude: number; longitude: number }
    destination?: { name: string; latitude: number; longitude: number }
    suggestedType?: TaskType
  }
}

// 出行建议
export interface TransportSuggestion {
  type: TaskType
  reason: string
  estimatedTime: number    // 分钟
  estimatedCost: number    // 元
  origin: { name: string; latitude: number; longitude: number }
  destination: { name: string; latitude: number; longitude: number }
}

@Injectable()
export class TransportValidator {
  private readonly logger = new Logger(TransportValidator.name)

  /**
   * 校验交通方式合理性
   */
  validate(
    type: TaskType,
    originName: string,
    destName: string,
    distance: number
  ): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: [],
    }

    // 打车校验
    if (type === 'taxi') {
      this.validateTaxi(originName, destName, distance, result)
    }

    // 高铁校验
    if (type === 'train') {
      this.validateTrain(originName, destName, distance, result)
    }

    // 飞机校验
    if (type === 'flight') {
      this.validateFlight(originName, destName, distance, result)
    }

    return result
  }

  /**
   * 打车校验
   */
  private validateTaxi(
    originName: string,
    destName: string,
    distance: number,
    result: ValidationResult
  ): void {
    const rules = TRANSPORT_RULES.taxi
    const distanceKm = Math.round(distance / 1000)

    // 距离超过限制
    if (distance > rules.maxDistance) {
      result.valid = false
      result.errors.push(`打车距离 ${distanceKm}km，超过合理范围（${rules.maxDistance / 1000}km）`)
      result.suggestions.push(rules.message)
      
      // 建议改用其他交通方式
      if (distance > TRANSPORT_RULES.flight.minDistance) {
        result.suggestions.push('建议选择飞机出行')
        result.autoFix = { suggestedType: 'flight' }
      } else if (distance > TRANSPORT_RULES.train.minDistance) {
        result.suggestions.push('建议选择高铁出行')
        result.autoFix = { suggestedType: 'train' }
      }
    }
    // 距离较远警告
    else if (distance > rules.warningDistance) {
      result.warnings.push(`打车距离 ${distanceKm}km，费用可能较高，也可考虑高铁出行`)
    }
  }

  /**
   * 高铁校验
   */
  private validateTrain(
    originName: string,
    destName: string,
    distance: number,
    result: ValidationResult
  ): void {
    const rules = TRANSPORT_RULES.train
    const distanceKm = Math.round(distance / 1000)

    // 检查起点是否是火车站
    const originStation = findStationByCity(originName)
    const isOriginStation = isTrainStation(originName)
    
    // 检查终点是否是火车站
    const destStation = findStationByCity(destName)
    const isDestStation = isTrainStation(destName)

    // 起点不是火车站，尝试查找修正
    if (!isOriginStation) {
      if (originStation) {
        result.warnings.push(`起点"${originName}"将自动修正为"${originStation.name}"`)
        result.autoFix = {
          origin: {
            name: originStation.name,
            latitude: originStation.latitude,
            longitude: originStation.longitude,
          },
        }
      } else {
        result.warnings.push(`起点"${originName}"未找到对应火车站`)
      }
    }

    // 终点不是火车站，尝试查找修正
    if (!isDestStation) {
      if (destStation) {
        result.warnings.push(`终点"${destName}"将自动修正为"${destStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: destStation.name,
            latitude: destStation.latitude,
            longitude: destStation.longitude,
          },
        }
      } else {
        result.warnings.push(`终点"${destName}"未找到对应火车站`)
      }
    }

    // 距离过短
    if (distance < rules.minDistance) {
      result.warnings.push(`距离仅 ${distanceKm}km，高铁可能不是最佳选择`)
      result.suggestions.push('建议考虑打车或公交')
    }

    // 距离过长（飞机更合适）
    if (distance > rules.maxDistance) {
      result.warnings.push(`距离 ${distanceKm}km，飞机可能更快`)
      result.suggestions.push('建议考虑飞机出行')
      result.autoFix = { suggestedType: 'flight' }
    }
  }

  /**
   * 飞机校验
   */
  private validateFlight(
    originName: string,
    destName: string,
    distance: number,
    result: ValidationResult
  ): void {
    const rules = TRANSPORT_RULES.flight
    const distanceKm = Math.round(distance / 1000)

    // 检查起点是否是机场
    const originAirport = findAirportByCity(originName)
    const isOriginAirport = isAirport(originName)
    
    // 检查终点是否是机场
    const destAirport = findAirportByCity(destName)
    const isDestAirport = isAirport(destName)

    // 起点不是机场，尝试查找修正
    if (!isOriginAirport) {
      if (originAirport) {
        result.warnings.push(`起点"${originName}"将自动修正为"${originAirport.name}"`)
        result.autoFix = {
          origin: {
            name: originAirport.name,
            latitude: originAirport.latitude,
            longitude: originAirport.longitude,
          },
        }
      } else {
        result.warnings.push(`起点"${originName}"未找到对应机场`)
      }
    }

    // 终点不是机场，尝试查找修正
    if (!isDestAirport) {
      if (destAirport) {
        result.warnings.push(`终点"${destName}"将自动修正为"${destAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: destAirport.name,
            latitude: destAirport.latitude,
            longitude: destAirport.longitude,
          },
        }
      } else {
        result.warnings.push(`终点"${destName}"未找到对应机场`)
      }
    }

    // 终点不是机场，需要修正
    if (!isDestAirport) {
      result.warnings.push(`终点"${destName}"不是机场`)
      if (destAirport) {
        result.suggestions.push(`建议到"${destAirport.name}"`)
      }
    }

    // 自动修正起终点
    if (originAirport || destAirport) {
      result.autoFix = {
        origin: originAirport ? {
          name: originAirport.name,
          latitude: originAirport.latitude,
          longitude: originAirport.longitude,
        } : undefined,
        destination: destAirport ? {
          name: destAirport.name,
          latitude: destAirport.latitude,
          longitude: destAirport.longitude,
        } : undefined,
      }
    }

    // 距离过短（高铁更合适）
    if (distance < rules.minDistance && distance > TRANSPORT_RULES.train.minDistance) {
      result.warnings.push(`距离 ${distanceKm}km，高铁可能更便捷`)
      result.suggestions.push('建议考虑高铁出行')
      result.autoFix = { suggestedType: 'train' }
    }

    // 距离非常短
    if (distance < TRANSPORT_RULES.train.minDistance) {
      result.warnings.push(`距离仅 ${distanceKm}km，飞机不是最佳选择`)
      result.suggestions.push('建议考虑打车或高铁')
      result.autoFix = { suggestedType: 'taxi' }
    }
  }

  /**
   * 获取正确的交通节点（机场/火车站）
   */
  getCorrectNode(
    type: TaskType,
    cityName: string,
    isDestination: boolean
  ): { name: string; latitude: number; longitude: number } | null {
    // 清理城市名
    const city = cityName.replace(/[市站场机场]/g, '').trim()

    if (type === 'flight') {
      const airport = findAirportByCity(city)
      if (airport) {
        return {
          name: airport.name,
          latitude: airport.latitude,
          longitude: airport.longitude,
        }
      }
      this.logger.warn(`未找到城市 ${city} 的机场`)
      return null
    }

    if (type === 'train') {
      const station = findStationByCity(city)
      if (station) {
        return {
          name: station.name,
          latitude: station.latitude,
          longitude: station.longitude,
        }
      }
      this.logger.warn(`未找到城市 ${city} 的火车站`)
      return null
    }

    // 其他类型返回原城市名，坐标需要通过地理编码获取
    return null
  }

  /**
   * 根据距离推荐交通方式
   */
  recommendTransport(distance: number): TaskType {
    const distanceKm = distance / 1000

    if (distanceKm < 30) {
      return 'taxi'
    } else if (distanceKm < 300) {
      return 'train'
    } else {
      return 'flight'
    }
  }

  /**
   * 生成多段行程建议
   * 例如：打车去机场 → 飞机 → 打车到目的地
   */
  generateMultiSegmentPlan(
    originCity: string,
    destCity: string,
    distance: number,
    scheduledTime: Date
  ): Array<{
    type: TaskType
    title: string
    origin: { name: string; latitude: number; longitude: number }
    destination: { name: string; latitude: number; longitude: number }
    scheduledTime: Date
  }> {
    const segments: Array<{
      type: TaskType
      title: string
      origin: { name: string; latitude: number; longitude: number }
      destination: { name: string; latitude: number; longitude: number }
      scheduledTime: Date
    }> = []

    // 如果是飞机行程，需要添加接驳段
    if (distance > TRANSPORT_RULES.flight.minDistance) {
      // 获取机场信息
      const originAirport = findAirportByCity(originCity)
      const destAirport = findAirportByCity(destCity)

      if (originAirport && destAirport) {
        // 第一段：打车去机场
        segments.push({
          type: 'taxi',
          title: `打车去${originAirport.name}`,
          origin: { name: originCity, latitude: 0, longitude: 0 }, // 需要实际坐标
          destination: {
            name: originAirport.name,
            latitude: originAirport.latitude,
            longitude: originAirport.longitude,
          },
          scheduledTime: new Date(scheduledTime.getTime() - 2 * 60 * 60 * 1000), // 提前2小时
        })

        // 第二段：飞机
        segments.push({
          type: 'flight',
          title: `飞往${destAirport.name}`,
          origin: {
            name: originAirport.name,
            latitude: originAirport.latitude,
            longitude: originAirport.longitude,
          },
          destination: {
            name: destAirport.name,
            latitude: destAirport.latitude,
            longitude: destAirport.longitude,
          },
          scheduledTime,
        })

        // 第三段：打车到目的地
        segments.push({
          type: 'taxi',
          title: `打车到目的地`,
          origin: {
            name: destAirport.name,
            latitude: destAirport.latitude,
            longitude: destAirport.longitude,
          },
          destination: { name: destCity, latitude: 0, longitude: 0 },
          scheduledTime: new Date(scheduledTime.getTime() + 30 * 60 * 1000), // 落地后30分钟
        })
      }
    }
    // 高铁行程，也需要添加接驳段
    else if (distance > TRANSPORT_RULES.train.minDistance) {
      const originStation = findStationByCity(originCity)
      const destStation = findStationByCity(destCity)

      if (originStation && destStation) {
        // 第一段：打车去火车站
        segments.push({
          type: 'taxi',
          title: `打车去${originStation.name}`,
          origin: { name: originCity, latitude: 0, longitude: 0 },
          destination: {
            name: originStation.name,
            latitude: originStation.latitude,
            longitude: originStation.longitude,
          },
          scheduledTime: new Date(scheduledTime.getTime() - 30 * 60 * 1000), // 提前30分钟
        })

        // 第二段：高铁
        segments.push({
          type: 'train',
          title: `高铁去${destCity}`,
          origin: {
            name: originStation.name,
            latitude: originStation.latitude,
            longitude: originStation.longitude,
          },
          destination: {
            name: destStation.name,
            latitude: destStation.latitude,
            longitude: destStation.longitude,
          },
          scheduledTime,
        })

        // 第三段：打车到目的地
        segments.push({
          type: 'taxi',
          title: `打车到目的地`,
          origin: {
            name: destStation.name,
            latitude: destStation.latitude,
            longitude: destStation.longitude,
          },
          destination: { name: destCity, latitude: 0, longitude: 0 },
          scheduledTime: new Date(scheduledTime.getTime() + 15 * 60 * 1000),
        })
      }
    }

    return segments
  }
}
