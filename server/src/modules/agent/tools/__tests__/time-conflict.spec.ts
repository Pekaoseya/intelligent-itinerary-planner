/**
 * 时间冲突检测模块单元测试
 */

import { estimateTaskDuration } from '../time-conflict'

describe('estimateTaskDuration', () => {
  it('应该从 metadata.duration 返回正确的分钟数', () => {
    const result = estimateTaskDuration('taxi', 0, { duration: 3600 }) // 1小时
    expect(result).toBe(60)
  })

  it('应该根据打车距离估算时长', () => {
    const result = estimateTaskDuration('taxi', 30000) // 30km
    expect(result).toBe(60) // 30km / 30km/h = 1h
  })

  it('打车时长最小应为 15 分钟', () => {
    const result = estimateTaskDuration('taxi', 1000) // 1km
    expect(result).toBe(15)
  })

  it('应该根据高铁距离估算时长（含候车时间）', () => {
    const result = estimateTaskDuration('train', 400000) // 400km
    expect(result).toBe(150) // 400km / 200km/h = 2h + 30min候车
  })

  it('应该根据飞机距离估算时长（含提前到机场时间）', () => {
    const result = estimateTaskDuration('flight', 1200000) // 1200km
    // 1200km / 600km/h = 2h飞行时间 + 150min提前到机场 + 落地后时间
    expect(result).toBeGreaterThan(120) // 至少 2 小时
  })

  it('会议默认 1 小时', () => {
    const result = estimateTaskDuration('meeting')
    expect(result).toBe(60)
  })

  it('用餐默认 1.5 小时', () => {
    const result = estimateTaskDuration('dining')
    expect(result).toBe(90)
  })

  it('酒店默认 8 小时', () => {
    const result = estimateTaskDuration('hotel')
    expect(result).toBe(480)
  })

  it('其他类型默认 1 小时', () => {
    const result = estimateTaskDuration('todo')
    expect(result).toBe(60)
  })
})
