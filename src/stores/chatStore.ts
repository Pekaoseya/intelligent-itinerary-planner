/**
 * 对话状态管理
 * 管理所有对话相关的状态和操作
 */
import { create } from 'zustand'
import type { StreamConnection } from '@/streaming'

// =============================================
// 类型定义
// =============================================

export type MessageRole = 'user' | 'assistant'

export interface ToolResult {
  tool: string
  args: unknown
  result: {
    success: boolean
    data?: unknown
    message?: string
    error?: string
  }
}

export interface MessageData {
  task?: any
  tasks?: any[]
  deleted?: any
  deletedCount?: number
  needConfirm?: boolean
  needConfirmation?: boolean
  confirmType?: 'batch_add' | 'batch_delete' | 'modify'
  pendingTasks?: any[]
  pendingCount?: number
  pendingDeleteTasks?: any[]
  pendingDeleteIds?: string[]
  pendingDeleteCount?: number
  originalTask?: any
  updatedTask?: any
  updates?: any
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  reasoning?: string[]
  tool_results?: ToolResult[]
  data?: MessageData
  timestamp: Date
}

// =============================================
// Store 定义
// =============================================

interface ChatState {
  // 消息列表
  messages: Message[]
  inputText: string
  isLoading: boolean
  scrollCounter: number
  
  // 流式连接相关（用 ref 管理，不触发重渲染）
  connectionRef: StreamConnection | null
  currentAiMessageId: string | null
  
  // 缓冲渲染相关（用 ref 管理）
  contentBuffer: string
  bufferTimer: ReturnType<typeof setTimeout> | null
  
  // Actions
  setInputText: (text: string) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendMessageContent: (id: string, content: string) => void
  setLoading: (loading: boolean) => void
  triggerScroll: () => void
  
  // 流式连接管理
  setConnection: (connection: StreamConnection | null) => void
  setCurrentAiMessageId: (id: string | null) => void
  
  // 缓冲管理
  appendToBuffer: (chunk: string, targetId: string) => void
  flushBuffer: () => void
  clearBufferTimer: () => void
  
  // 重置
  reset: () => void
}

const BUFFER_INTERVAL = 80

const initialState = {
  messages: [
    {
      id: 'welcome',
      role: 'assistant' as const,
      content: '您好！我是您的智能助手。\n\n我可以帮您管理任务：打车、火车、飞机、会议、餐饮、酒店、事务等。\n\n直接告诉我您想做什么，我会理解您的需求。',
      timestamp: new Date(),
    },
  ],
  inputText: '',
  isLoading: false,
  scrollCounter: 0,
  connectionRef: null,
  currentAiMessageId: null,
  contentBuffer: '',
  bufferTimer: null,
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,
  
  // ========== 消息相关 ==========
  
  setInputText: (text) => set({ inputText: text }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),
  
  appendMessageContent: (id, content) => set((state) => ({
    messages: state.messages.map(msg => 
      msg.id === id ? { ...msg, content: msg.content + content } : msg
    )
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  triggerScroll: () => set((state) => ({
    scrollCounter: state.scrollCounter + 1
  })),
  
  // ========== 流式连接管理 ==========
  
  setConnection: (connection) => set({ connectionRef: connection }),
  
  setCurrentAiMessageId: (id) => set({ currentAiMessageId: id }),
  
  // ========== 缓冲渲染 ==========
  
  appendToBuffer: (chunk, _targetId) => {
    if (!chunk) return
    
    const state = get()
    
    // 追加到缓冲区
    set({ contentBuffer: state.contentBuffer + chunk })
    
    // 如果没有定时器，创建一个
    if (!state.bufferTimer) {
      const timer = setTimeout(() => {
        const currentState = get()
        const bufferedContent = currentState.contentBuffer
        
        // 清空缓冲区和定时器
        set({ contentBuffer: '', bufferTimer: null })
        
        // 更新消息内容（使用传入的 targetId 或 state 中的）
        const targetId = _targetId || currentState.currentAiMessageId
        if (bufferedContent && targetId) {
          set((s) => ({
            messages: s.messages.map(m => 
              m.id === targetId 
                ? { ...m, content: m.content + bufferedContent }
                : m
            )
          }))
        }
      }, BUFFER_INTERVAL)
      
      set({ bufferTimer: timer })
    }
  },
  
  flushBuffer: () => {
    const state = get()
    
    // 清除定时器
    if (state.bufferTimer) {
      clearTimeout(state.bufferTimer)
      set({ bufferTimer: null })
    }
    
    const bufferedContent = state.contentBuffer
    
    // 清空缓冲区
    set({ contentBuffer: '' })
    
    // 更新消息内容
    if (bufferedContent && state.currentAiMessageId) {
      const currentId = state.currentAiMessageId
      set((s) => ({
        messages: s.messages.map(m => 
          m.id === currentId 
            ? { ...m, content: m.content + bufferedContent }
            : m
        )
      }))
    }
  },
  
  clearBufferTimer: () => {
    const state = get()
    if (state.bufferTimer) {
      clearTimeout(state.bufferTimer)
      set({ bufferTimer: null })
    }
  },
  
  // ========== 重置 ==========
  
  reset: () => {
    const state = get()
    if (state.bufferTimer) {
      clearTimeout(state.bufferTimer)
    }
    if (state.connectionRef) {
      state.connectionRef.abort()
    }
    set(initialState)
  },
}))
