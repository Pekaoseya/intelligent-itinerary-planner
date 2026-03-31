/**
 * 确认弹窗状态管理
 * 管理批量操作确认弹窗的状态
 */
import { create } from 'zustand'

// =============================================
// 类型定义
// =============================================

export type ConfirmType = 'batch_add' | 'batch_delete' | 'modify'

// =============================================
// Store 定义
// =============================================

interface ConfirmState {
  // 状态
  visible: boolean
  confirmType: ConfirmType
  
  // 批量创建
  pendingTasks: any[]  // PendingTask[]
  
  // 批量删除
  pendingDeleteTasks: any[]  // Task[]
  pendingDeleteIds: string[]
  
  // 单个任务更新
  originalTask: any  // PendingTask | null
  updatedTask: any   // PendingTask | null
  
  // Actions
  showBatchAdd: (tasks: any[]) => void
  showBatchDelete: (tasks: any[], ids: string[]) => void
  showModify: (original: any, updated: any) => void
  hide: () => void
  reset: () => void
  clearPendingTasks: () => void
  clearPendingDeleteTasks: () => void
  clearAll: () => void
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
    pendingDeleteTasks: [],
    pendingDeleteIds: [],
    originalTask: null,
    updatedTask: null,
  }),
  
  showBatchDelete: (tasks, ids) => set({
    visible: true,
    confirmType: 'batch_delete',
    pendingDeleteTasks: tasks,
    pendingDeleteIds: ids,
    pendingTasks: [],
    originalTask: null,
    updatedTask: null,
  }),
  
  showModify: (original, updated) => set({
    visible: true,
    confirmType: 'modify',
    originalTask: original,
    updatedTask: updated,
    pendingTasks: [],
    pendingDeleteTasks: [],
    pendingDeleteIds: [],
  }),
  
  hide: () => set({ visible: false }),
  
  clearPendingTasks: () => set({ pendingTasks: [] }),
  
  clearPendingDeleteTasks: () => set({ 
    pendingDeleteTasks: [], 
    pendingDeleteIds: [] 
  }),
  
  clearAll: () => set({
    pendingTasks: [],
    pendingDeleteTasks: [],
    pendingDeleteIds: [],
    originalTask: null,
    updatedTask: null,
  }),
  
  reset: () => set(initialState),
}))
