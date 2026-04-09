/**
 * 确认弹窗状态管理
 * 管理批量操作确认弹窗的状态
 */
import { create } from 'zustand'

// =============================================
// 类型定义
// =============================================

export type ConfirmType = 'batch_add' | 'batch_delete' | 'modify' | 'trip_plan'

// 行程路线信息
export interface RouteInfo {
  id: string
  name: string
  totalDistance: number
  totalDuration: number
  totalCost?: number
  segments: Array<{
    mode: 'taxi' | 'train' | 'flight' | 'walking'
    origin: { name: string }
    destination: { name: string }
    distance: number
    duration: number
    cost?: number
  }>
  highlights?: string[]
}

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
  
  // 行程规划
  routes: RouteInfo[]
  recommendedIndex: number
  summary: string
  reasoning: string[]

  // 时间冲突
  conflicts: any[]  // { task, newTask, overlapMinutes }
  hasConflict: boolean
  canConfirm: boolean

  // 冲突优化方案
  conflictOptimization: any  // { conflictAnalysis, optimizationSuggestions, reasoning, modifiedTasks }
  isOptimizing: boolean
  
  // Actions
  showBatchAdd: (tasks: any[]) => void
  showBatchDelete: (tasks: any[], ids: string[]) => void
  showModify: (original: any, updated: any) => void
  showTripPlan: (tasks: any[], routes: RouteInfo[], summary: string, reasoning?: string[]) => void
  setConflicts: (conflicts: any[], canConfirm: boolean) => void
  setConflictOptimization: (optimization: any) => void
  setOptimizing: (isOptimizing: boolean) => void
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
  routes: [],
  recommendedIndex: 0,
  summary: '',
  reasoning: [],
  conflicts: [],
  hasConflict: false,
  canConfirm: true,
  conflictOptimization: null,
  isOptimizing: false,
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
    routes: [],
    summary: '',
    reasoning: [],
    conflicts: [],
    hasConflict: false,
    canConfirm: true,
  }),

  showBatchDelete: (tasks, ids) => set({
    visible: true,
    confirmType: 'batch_delete',
    pendingDeleteTasks: tasks,
    pendingDeleteIds: ids,
    pendingTasks: [],
    originalTask: null,
    updatedTask: null,
    routes: [],
    summary: '',
    reasoning: [],
    conflicts: [],
    hasConflict: false,
    canConfirm: true,
  }),

  showModify: (original, updated) => set({
    visible: true,
    confirmType: 'modify',
    originalTask: original,
    updatedTask: updated,
    pendingTasks: [],
    pendingDeleteTasks: [],
    pendingDeleteIds: [],
    routes: [],
    summary: '',
    reasoning: [],
    conflicts: [],
    hasConflict: false,
    canConfirm: true,
  }),

  showTripPlan: (tasks, routes, summary, reasoning = []) => set({
    visible: true,
    confirmType: 'trip_plan',
    pendingTasks: tasks,
    routes,
    recommendedIndex: 0,
    summary,
    reasoning,
    pendingDeleteTasks: [],
    pendingDeleteIds: [],
    originalTask: null,
    updatedTask: null,
    conflicts: [],
    hasConflict: false,
    canConfirm: true, // 初始值为 true，稍后通过 setConflicts 更新
    conflictOptimization: null,
    isOptimizing: false,
  }),

  setConflicts: (conflicts, canConfirm) => set({
    conflicts,
    hasConflict: conflicts.length > 0,
    canConfirm,
  }),

  setConflictOptimization: (optimization) => set({
    conflictOptimization: optimization,
    isOptimizing: false,
  }),

  setOptimizing: (isOptimizing) => set({
    isOptimizing,
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
    routes: [],
    summary: '',
    reasoning: [],
  }),
  
  reset: () => set(initialState),
}))
