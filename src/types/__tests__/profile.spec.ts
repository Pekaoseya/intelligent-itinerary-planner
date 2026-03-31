/**
 * Profile 类型工具函数测试
 */

import { TRAVEL_TYPE_CONFIG, TIME_PERIOD_CONFIG, WEEKDAY_CONFIG } from '../profile'

describe('TRAVEL_TYPE_CONFIG', () => {
  it('should have all travel types defined', () => {
    const expectedTypes = ['taxi', 'train', 'flight']
    expectedTypes.forEach(type => {
      expect(TRAVEL_TYPE_CONFIG[type]).toBeDefined()
      expect(TRAVEL_TYPE_CONFIG[type].name).toBeTruthy()
      expect(TRAVEL_TYPE_CONFIG[type].color).toBeTruthy()
      expect(TRAVEL_TYPE_CONFIG[type].bgColor).toBeTruthy()
    })
  })

  it('should have correct names', () => {
    expect(TRAVEL_TYPE_CONFIG.taxi.name).toBe('打车')
    expect(TRAVEL_TYPE_CONFIG.train.name).toBe('高铁')
    expect(TRAVEL_TYPE_CONFIG.flight.name).toBe('飞机')
  })

  it('should have valid color formats', () => {
    Object.values(TRAVEL_TYPE_CONFIG).forEach(config => {
      // 颜色应该是有效的 hex 格式
      expect(config.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(config.bgColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })
})

describe('TIME_PERIOD_CONFIG', () => {
  it('should have all time periods defined', () => {
    const expectedPeriods = ['morning', 'afternoon', 'evening', 'night']
    expectedPeriods.forEach(period => {
      expect(TIME_PERIOD_CONFIG[period]).toBeDefined()
      expect(TIME_PERIOD_CONFIG[period].name).toBeTruthy()
      expect(TIME_PERIOD_CONFIG[period].color).toBeTruthy()
    })
  })

  it('should have correct names', () => {
    expect(TIME_PERIOD_CONFIG.morning.name).toBe('上午')
    expect(TIME_PERIOD_CONFIG.afternoon.name).toBe('下午')
    expect(TIME_PERIOD_CONFIG.evening.name).toBe('晚间')
    expect(TIME_PERIOD_CONFIG.night.name).toBe('凌晨')
  })
})

describe('WEEKDAY_CONFIG', () => {
  it('should have all weekdays defined', () => {
    const expectedDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    expectedDays.forEach(day => {
      expect(WEEKDAY_CONFIG[day]).toBeDefined()
      expect(WEEKDAY_CONFIG[day].name).toBeTruthy()
      expect(typeof WEEKDAY_CONFIG[day].isWeekend).toBe('boolean')
    })
  })

  it('should correctly identify weekends', () => {
    expect(WEEKDAY_CONFIG.mon.isWeekend).toBe(false)
    expect(WEEKDAY_CONFIG.tue.isWeekend).toBe(false)
    expect(WEEKDAY_CONFIG.wed.isWeekend).toBe(false)
    expect(WEEKDAY_CONFIG.thu.isWeekend).toBe(false)
    expect(WEEKDAY_CONFIG.fri.isWeekend).toBe(false)
    expect(WEEKDAY_CONFIG.sat.isWeekend).toBe(true)
    expect(WEEKDAY_CONFIG.sun.isWeekend).toBe(true)
  })

  it('should have correct names', () => {
    expect(WEEKDAY_CONFIG.mon.name).toBe('一')
    expect(WEEKDAY_CONFIG.fri.name).toBe('五')
    expect(WEEKDAY_CONFIG.sat.name).toBe('六')
    expect(WEEKDAY_CONFIG.sun.name).toBe('日')
  })
})
