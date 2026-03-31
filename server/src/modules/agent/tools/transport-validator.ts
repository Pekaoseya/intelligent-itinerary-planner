/**
 * 交通方式校验工具
 */

import {
  findAirportByCity,
  findStationByCity,
  isAirport,
  isTrainStation,
  TRANSPORT_RULES,
} from '../../map/transport-nodes'
import {
  findAirportByCityViaAPI,
  findStationByCityViaAPI,
  extractCityName,
} from './map-utils'
import type { TaskType, ValidationResult } from './types'

// =============================================
// 交通方式校验
// =============================================

export async function validateTransport(
  type: TaskType,
  originName: string | undefined,
  destName: string | undefined,
  distance: number
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    suggestions: [],
  }

  if (type === 'taxi') {
    validateTaxi(originName, destName, distance, result)
  } else if (type === 'train') {
    await validateTrain(originName, destName, distance, result)
  } else if (type === 'flight') {
    await validateFlight(originName, destName, distance, result)
  }

  return result
}

// =============================================
// 打车校验
// =============================================

function validateTaxi(
  originName: string | undefined,
  destName: string | undefined,
  distance: number,
  result: ValidationResult
): void {
  const rules = TRANSPORT_RULES.taxi
  const distanceKm = Math.round(distance / 1000)

  if (distance > rules.maxDistance) {
    result.valid = false
    result.errors.push(`打车距离 ${distanceKm}km，超过合理范围`)
    result.suggestions.push(rules.message)

    if (distance > TRANSPORT_RULES.flight.minDistance) {
      result.suggestions.push('建议选择飞机出行')
      result.autoFix = { suggestedType: 'flight' }
    } else if (distance > TRANSPORT_RULES.train.minDistance) {
      result.suggestions.push('建议选择高铁出行')
      result.autoFix = { suggestedType: 'train' }
    }
  } else if (distance > rules.warningDistance) {
    result.warnings.push(`打车距离 ${distanceKm}km，费用可能较高`)
  }
}

// =============================================
// 高铁校验
// =============================================

async function validateTrain(
  originName: string | undefined,
  destName: string | undefined,
  distance: number,
  result: ValidationResult
): Promise<void> {
  // 检查起点是否是火车站
  if (originName) {
    const originCity = extractCityName(originName)
    const apiStation = await findStationByCityViaAPI(originCity)

    if (apiStation) {
      const isStation = originName.includes('站')
      if (!isStation) {
        result.warnings.push(`起点"${originName}"将自动修正为"${apiStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: apiStation.name,
            latitude: apiStation.latitude,
            longitude: apiStation.longitude,
          },
        }
      }
    } else {
      const localStation = findStationByCity(originName)
      const isStation = isTrainStation(originName)

      if (!isStation && localStation) {
        result.warnings.push(`起点"${originName}"将自动修正为"${localStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: localStation.name,
            latitude: localStation.latitude,
            longitude: localStation.longitude,
          },
        }
      } else if (!isStation && !localStation) {
        result.warnings.push(`起点"${originName}"未找到对应火车站`)
      }
    }
  }

  // 检查终点是否是火车站
  if (destName) {
    const destCity = extractCityName(destName)
    const apiStation = await findStationByCityViaAPI(destCity)

    if (apiStation) {
      const isStation = destName.includes('站')
      if (!isStation) {
        result.warnings.push(`终点"${destName}"将自动修正为"${apiStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: apiStation.name,
            latitude: apiStation.latitude,
            longitude: apiStation.longitude,
          },
        }
      }
    } else {
      const localStation = findStationByCity(destName)
      const isStation = isTrainStation(destName)

      if (!isStation && localStation) {
        result.warnings.push(`终点"${destName}"将自动修正为"${localStation.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: localStation.name,
            latitude: localStation.latitude,
            longitude: localStation.longitude,
          },
        }
      }
    }
  }

  // 距离过短
  if (distance < TRANSPORT_RULES.train.minDistance) {
    result.warnings.push(`距离仅 ${Math.round(distance / 1000)}km，高铁可能不是最佳选择`)
  }
}

// =============================================
// 飞机校验
// =============================================

async function validateFlight(
  originName: string | undefined,
  destName: string | undefined,
  distance: number,
  result: ValidationResult
): Promise<void> {
  // 检查起点是否是机场
  if (originName) {
    const originCity = extractCityName(originName)
    const apiAirport = await findAirportByCityViaAPI(originCity)

    if (apiAirport) {
      const isAir = originName.includes('机场')
      if (!isAir) {
        result.warnings.push(`起点"${originName}"将自动修正为"${apiAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: apiAirport.name,
            latitude: apiAirport.latitude,
            longitude: apiAirport.longitude,
          },
        }
      }
    } else {
      const localAirport = findAirportByCity(originName)
      const isAir = isAirport(originName)

      if (!isAir && localAirport) {
        result.warnings.push(`起点"${originName}"将自动修正为"${localAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          origin: {
            name: localAirport.name,
            latitude: localAirport.latitude,
            longitude: localAirport.longitude,
          },
        }
      } else if (!isAir && !localAirport) {
        result.warnings.push(`起点"${originName}"未找到对应机场`)
      }
    }
  }

  // 检查终点是否是机场
  if (destName) {
    const destCity = extractCityName(destName)
    const apiAirport = await findAirportByCityViaAPI(destCity)

    if (apiAirport) {
      const isAir = destName.includes('机场')
      if (!isAir) {
        result.warnings.push(`终点"${destName}"将自动修正为"${apiAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: apiAirport.name,
            latitude: apiAirport.latitude,
            longitude: apiAirport.longitude,
          },
        }
      }
    } else {
      const localAirport = findAirportByCity(destName)
      const isAir = isAirport(destName)

      if (!isAir && localAirport) {
        result.warnings.push(`终点"${destName}"将自动修正为"${localAirport.name}"`)
        result.autoFix = {
          ...result.autoFix,
          destination: {
            name: localAirport.name,
            latitude: localAirport.latitude,
            longitude: localAirport.longitude,
          },
        }
      }
    }
  }

  // 距离过短（高铁更合适）
  if (distance < TRANSPORT_RULES.flight.minDistance && distance > TRANSPORT_RULES.train.minDistance) {
    result.warnings.push(`距离 ${Math.round(distance / 1000)}km，高铁可能更便捷`)
    result.suggestions.push('建议考虑高铁出行')
    result.autoFix = { ...result.autoFix, suggestedType: 'train' }
  }
}

// =============================================
// 获取正确的交通节点坐标
// =============================================

export function getCorrectNode(
  type: TaskType,
  cityName: string
): { name: string; latitude: number; longitude: number } | null {
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
  }

  return null
}
