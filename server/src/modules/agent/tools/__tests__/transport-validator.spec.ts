/**
 * 交通校验模块单元测试
 */

import { validateTransport } from '../transport-validator'

// Mock 地图工具函数
jest.mock('../map-utils', () => ({
  findStationByCityViaAPI: jest.fn().mockResolvedValue(null),
  findAirportByCityViaAPI: jest.fn().mockResolvedValue(null),
  extractCityName: (name: string) => name.replace(/站|机场|东|南|西|北/g, '').trim(),
}))

// Mock 交通节点数据 - 使用正确的相对路径
jest.mock('../../../map/transport-nodes', () => ({
  findAirportByCity: (city: string) => city === '北京' ? { name: '北京首都国际机场', latitude: 40.08, longitude: 116.58 } : null,
  findStationByCity: (city: string) => city === '北京' ? { name: '北京站', latitude: 39.90, longitude: 116.43 } : null,
  isAirport: (name: string) => name.includes('机场'),
  isTrainStation: (name: string) => name.includes('站'),
  TRANSPORT_RULES: {
    taxi: { maxDistance: 100000, warningDistance: 50000, message: '距离过远' },
    train: { minDistance: 50000 },
    flight: { minDistance: 300000 },
  },
}))

describe('validateTransport', () => {
  describe('打车校验', () => {
    it('短距离打车应该有效', async () => {
      const result = await validateTransport('taxi', '起点', '终点', 10000) // 10km
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('中等距离打车应该有警告', async () => {
      const result = await validateTransport('taxi', '起点', '终点', 60000) // 60km
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('超长距离打车应该无效并建议高铁', async () => {
      const result = await validateTransport('taxi', '起点', '终点', 150000) // 150km
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.autoFix?.suggestedType).toBe('train')
    })

    it('极远距离打车应该建议飞机', async () => {
      const result = await validateTransport('taxi', '起点', '终点', 500000) // 500km
      expect(result.valid).toBe(false)
      expect(result.autoFix?.suggestedType).toBe('flight')
    })
  })

  describe('高铁校验', () => {
    it('短距离高铁应该有警告', async () => {
      const result = await validateTransport('train', '北京', '天津', 30000) // 30km
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('飞机校验', () => {
    it('中距离飞机应该建议高铁', async () => {
      const result = await validateTransport('flight', '北京', '上海', 200000) // 200km
      expect(result.warnings.some(w => w.includes('高铁'))).toBe(true)
    })
  })
})
