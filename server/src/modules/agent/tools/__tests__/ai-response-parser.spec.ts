/**
 * 测试 AI 响应解析
 * 验证 extractDataFromResults 能否正确收集任务参数
 */

// 模拟 extractDataFromResults 的逻辑
function extractDataFromResults(results: any[]): any {
  const data: any = {}
  const pendingTasks: any[] = []
  const pendingDeleteTasks: any[] = []
  const pendingDeleteIds: string[] = []

  for (const r of results) {
    if (r.result.success && r.result.data) {
      if (r.tool === 'task_query') {
        data.tasks = r.result.data.tasks
      } else if (r.tool === 'task_create') {
        const resultData = r.result.data
        if (resultData.preview && resultData.task) {
          pendingTasks.push(resultData.task)
        }
      } else if (r.tool === 'task_update') {
        const resultData = r.result.data
        if (resultData.preview) {
          data.needConfirmation = true
          data.confirmType = 'modify'
          data.originalTask = resultData.originalTask
          data.updatedTask = resultData.updatedTask
          data.updates = resultData.updates
        }
      } else if (r.tool === 'task_delete') {
        const resultData = r.result.data
        if (resultData.preview) {
          if (resultData.tasks && resultData.tasks.length > 0) {
            pendingDeleteTasks.push(...resultData.tasks)
            pendingDeleteIds.push(...(resultData.taskIds || resultData.tasks.map((t: any) => t.id)))
          }
        }
      }
    }
  }

  if (pendingTasks.length > 0) {
    data.needConfirmation = true
    data.confirmType = 'batch_add'
    data.pendingTasks = pendingTasks
    data.pendingCount = pendingTasks.length
  }

  if (pendingDeleteTasks.length > 0) {
    data.needConfirmation = true
    data.confirmType = 'batch_delete'
    data.pendingDeleteTasks = pendingDeleteTasks
    data.pendingDeleteIds = pendingDeleteIds
    data.pendingDeleteCount = pendingDeleteTasks.length
  }

  return Object.keys(data).length > 0 ? data : undefined
}

describe('AI 响应解析测试', () => {
  
  describe('批量创建任务', () => {
    it('应该正确收集单个任务参数', () => {
      const results = [
        {
          tool: 'task_create',
          result: {
            success: true,
            data: {
              preview: true,
              task: {
                title: '打车到杭州东站',
                type: 'taxi',
                scheduled_time: '2026-04-01T07:30:00',
                location_name: '家',
                destination_name: '杭州东站',
              }
            }
          }
        }
      ]
      
      const data = extractDataFromResults(results)
      
      expect(data).toBeDefined()
      expect(data.needConfirmation).toBe(true)
      expect(data.confirmType).toBe('batch_add')
      expect(data.pendingTasks).toHaveLength(1)
      expect(data.pendingTasks[0].title).toBe('打车到杭州东站')
      expect(data.pendingCount).toBe(1)
    })

    it('应该正确收集多个任务参数', () => {
      const results = [
        {
          tool: 'task_create',
          result: {
            success: true,
            data: {
              preview: true,
              task: {
                title: '打车到杭州东站',
                type: 'taxi',
                scheduled_time: '2026-04-01T07:30:00',
              }
            }
          }
        },
        {
          tool: 'task_create',
          result: {
            success: true,
            data: {
              preview: true,
              task: {
                title: '高铁G7301去上海',
                type: 'train',
                scheduled_time: '2026-04-01T08:30:00',
              }
            }
          }
        },
        {
          tool: 'task_create',
          result: {
            success: true,
            data: {
              preview: true,
              task: {
                title: '上海午餐',
                type: 'dining',
                scheduled_time: '2026-04-01T12:30:00',
              }
            }
          }
        }
      ]
      
      const data = extractDataFromResults(results)
      
      expect(data).toBeDefined()
      expect(data.needConfirmation).toBe(true)
      expect(data.confirmType).toBe('batch_add')
      expect(data.pendingTasks).toHaveLength(3)
      expect(data.pendingCount).toBe(3)
      expect(data.pendingTasks[0].title).toBe('打车到杭州东站')
      expect(data.pendingTasks[1].title).toBe('高铁G7301去上海')
      expect(data.pendingTasks[2].title).toBe('上海午餐')
    })
  })

  describe('批量删除任务', () => {
    it('应该正确收集单个待删除任务', () => {
      const results = [
        {
          tool: 'task_delete',
          result: {
            success: true,
            data: {
              preview: true,
              deleteType: 'single',
              tasks: [{
                id: 'task-123',
                title: '会议',
                type: 'meeting',
                scheduled_time: '2026-04-01T10:00:00',
              }],
              count: 1,
              taskIds: ['task-123']
            }
          }
        }
      ]
      
      const data = extractDataFromResults(results)
      
      expect(data).toBeDefined()
      expect(data.needConfirmation).toBe(true)
      expect(data.confirmType).toBe('batch_delete')
      expect(data.pendingDeleteTasks).toHaveLength(1)
      expect(data.pendingDeleteIds).toContain('task-123')
      expect(data.pendingDeleteCount).toBe(1)
    })

    it('应该正确收集多个待删除任务', () => {
      const results = [
        {
          tool: 'task_delete',
          result: {
            success: true,
            data: {
              preview: true,
              deleteType: 'batch',
              tasks: [
                { id: 'task-1', title: '打车', type: 'taxi' },
                { id: 'task-2', title: '高铁', type: 'train' },
                { id: 'task-3', title: '午餐', type: 'dining' },
              ],
              count: 3,
              taskIds: ['task-1', 'task-2', 'task-3']
            }
          }
        }
      ]
      
      const data = extractDataFromResults(results)
      
      expect(data).toBeDefined()
      expect(data.confirmType).toBe('batch_delete')
      expect(data.pendingDeleteTasks).toHaveLength(3)
      expect(data.pendingDeleteIds).toHaveLength(3)
    })
  })

  describe('任务查询', () => {
    it('应该正确返回查询结果', () => {
      const results = [
        {
          tool: 'task_query',
          result: {
            success: true,
            data: {
              tasks: [
                { id: 'task-1', title: '会议' },
                { id: 'task-2', title: '午餐' },
              ],
              count: 2
            }
          }
        }
      ]
      
      const data = extractDataFromResults(results)
      
      expect(data).toBeDefined()
      expect(data.tasks).toHaveLength(2)
      expect(data.needConfirmation).toBeUndefined()
    })
  })

  describe('混合操作', () => {
    it('应该正确处理创建+查询混合', () => {
      const results = [
        {
          tool: 'task_query',
          result: {
            success: true,
            data: {
              tasks: [{ id: 'task-1', title: '已有会议' }],
              count: 1
            }
          }
        },
        {
          tool: 'task_create',
          result: {
            success: true,
            data: {
              preview: true,
              task: {
                title: '新任务',
                type: 'todo',
                scheduled_time: '2026-04-01T15:00:00',
              }
            }
          }
        }
      ]
      
      const data = extractDataFromResults(results)
      
      expect(data).toBeDefined()
      expect(data.tasks).toBeDefined()
      expect(data.needConfirmation).toBe(true)
      expect(data.confirmType).toBe('batch_add')
      expect(data.pendingTasks).toHaveLength(1)
    })
  })

  describe('失败情况', () => {
    it('应该忽略失败的工具调用', () => {
      const results = [
        {
          tool: 'task_create',
          result: {
            success: false,
            error: '时间冲突'
          }
        }
      ]
      
      const data = extractDataFromResults(results)
      
      expect(data).toBeUndefined()
    })

    it('应该处理空结果', () => {
      const results: any[] = []
      const data = extractDataFromResults(results)
      expect(data).toBeUndefined()
    })
  })
})
