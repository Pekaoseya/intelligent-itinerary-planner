/**
 * 地图工具模块单元测试
 */

import {
  calculateStraightDistance,
  generateStraightPolyline,
  extractCityName,
  formatTime,
} from '../map-utils'

describe('calculateStraightDistance', () => {
  it('应该正确计算两点之间的直线距离', () => {
    // 北京到上海（约 1068km）
    const distance = calculateStraightDistance(39.90, 116.40, 31.23, 121.47)
    expect(Math.round(distance / 1000)).toBeCloseTo(1068, -1) // 允许 ±10km 误差
  })

  it('相同点距离应为 0', () => {
    const distance = calculateStraightDistance(30.0, 120.0, 30.0, 120.0)
    expect(distance).toBe(0)
  })

  it('应该正确计算短距离', () => {
    // 约 1km
    const distance = calculateStraightDistance(30.0, 120.0, 30.01, 120.0)
    expect(distance).toBeGreaterThan(1000)
    expect(distance).toBeLessThan(1200)
  })
})

describe('generateStraightPolyline', () => {
  it('应该生成正确数量的插值点', () => {
    const origin = { latitude: 30.0, longitude: 120.0 }
    const dest = { latitude: 31.0, longitude: 121.0 }

    const polyline = generateStraightPolyline(origin, dest, 5)
    expect(polyline).toHaveLength(6) // 0-5 共 6 个点
  })

  it('默认应该生成 11 个点', () => {
    const origin = { latitude: 30.0, longitude: 120.0 }
    const dest = { latitude: 31.0, longitude: 121.0 }

    const polyline = generateStraightPolyline(origin, dest)
    expect(polyline).toHaveLength(11)
  })

  it('第一个点应该是起点', () => {
    const origin = { latitude: 30.0, longitude: 120.0 }
    const dest = { latitude: 31.0, longitude: 121.0 }

    const polyline = generateStraightPolyline(origin, dest, 10)
    expect(polyline[0]).toEqual(origin)
  })

  it('最后一个点应该是终点', () => {
    const origin = { latitude: 30.0, longitude: 120.0 }
    const dest = { latitude: 31.0, longitude: 121.0 }

    const polyline = generateStraightPolyline(origin, dest, 10)
    expect(polyline[polyline.length - 1]).toEqual(dest)
  })
})

describe('extractCityName', () => {
  it('应该从站点名称提取城市名', () => {
    expect(extractCityName('北京站')).toBe('北京')
    expect(extractCityName('上海虹桥站')).toBe('上海')
    expect(extractCityName('杭州东站')).toBe('杭州')
  })

  it('应该从机场名称提取城市名', () => {
    expect(extractCityName('北京首都国际机场')).toBe('北京')
    expect(extractCityName('上海浦东国际机场')).toBe('上海')
  })

  it('未知城市应返回处理后的名称', () => {
    expect(extractCityName('某地站')).toBe('某地')
  })
})

describe('formatTime', () => {
  it('应该正确格式化时间', () => {
    const isoString = '2024-01-15T14:30:00'
    expect(formatTime(isoString)).toBe('14:30')
  })

  it('应该补零', () => {
    const isoString = '2024-01-15T09:05:00'
    expect(formatTime(isoString)).toBe('09:05')
  })
})
