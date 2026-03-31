/**
 * 任务类型工具函数测试
 */

import { getTaskTypeName, getTaskTypeColor, type TaskType } from '../task'

describe('getTaskTypeName', () => {
  it('should return correct name for taxi', () => {
    expect(getTaskTypeName('taxi')).toBe('打车')
  })

  it('should return correct name for train', () => {
    expect(getTaskTypeName('train')).toBe('高铁')
  })

  it('should return correct name for flight', () => {
    expect(getTaskTypeName('flight')).toBe('飞机')
  })

  it('should return correct name for meeting', () => {
    expect(getTaskTypeName('meeting')).toBe('会议')
  })

  it('should return correct name for todo', () => {
    expect(getTaskTypeName('todo')).toBe('事务')
  })

  it('should return default name for unknown type', () => {
    expect(getTaskTypeName('other' as TaskType)).toBe('其他')
  })
})

describe('getTaskTypeColor', () => {
  it('should return correct color for taxi', () => {
    expect(getTaskTypeColor('taxi')).toBe('#faad14')
  })

  it('should return correct color for train', () => {
    expect(getTaskTypeColor('train')).toBe('#1890ff')
  })

  it('should return correct color for flight', () => {
    expect(getTaskTypeColor('flight')).toBe('#722ed1')
  })

  it('should return correct color for meeting', () => {
    expect(getTaskTypeColor('meeting')).toBe('#1890ff')
  })

  it('should return correct color for todo', () => {
    expect(getTaskTypeColor('todo')).toBe('#52c41a')
  })

  it('should return default color for unknown type', () => {
    expect(getTaskTypeColor('other' as TaskType)).toBe('#999')
  })
})
