/**
 * 确认弹窗状态管理
 */
import { create } from 'zustand'
import type { Task } from '@/types/task'
import type { PendingTask } from '@/components/confirmation'

type ConfirmType = 'batch_add' | 'batch_delete' | 'modify'

interface ConfirmState {
  // 状态
  visible: boolean
  confirmType: ConfirmType
  
  // 批量创建
  pendingTasks: PendingTask[]
  
  // 批量删除
  pendingDeleteTasks: Task[]
  pendingDeleteIds: string[]
  
  // 单个任务更新
  originalTask: PendingTask | null
  updatedTask: PendingTask | null
  
  // Actions
  showBatchAdd: (tasks: PendingTask[]) => void
  showBatchDelete: (tasks: Task[], ids: string[]) => void
  showModify: (original: PendingTask, updated: PendingTask) => void
  hide: () => void
  reset: () => void
}

const initialState = {
  visible: false,
  confirmType: 'batch_add' as ConfirmType,
  pendingTasks: [],
  pendingDeleteTasks: [],
  pendingDeleteIds: [],
  originalTask: null,
  updatedTask: null,
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  ...initialState,
  
  showBatchAdd: (tasks) => set({
    visible: true,
    confirmType: 'batch_add',
    pendingTasks: tasks,
  }),
  
  showBatchDelete: (tasks, ids) => set({
    visible: true,
    confirmType: 'batch_delete',
    pendingDeleteTasks: tasks,
    pendingDeleteIds: ids,
  }),
  
  showModify: (original, updated) => set({
    visible: true,
    confirmType: 'modify',
    originalTask: original,
    updatedTask: updated,
  }),
  
  hide: () => set({ visible: false }),
  
  reset: () => set(initialState),
}))
