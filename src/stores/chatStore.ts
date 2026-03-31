/**
 * 对话状态管理
 */
import { create } from 'zustand'
import type { Message, ToolResult, MessageData } from '@/types/chat'

interface ChatState {
  // 状态
  messages: Message[]
  isLoading: boolean
  inputText: string
  scrollCounter: number
  
  // Actions
  setInputText: (text: string) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendMessageContent: (id: string, content: string) => void
  setLoading: (loading: boolean) => void
  triggerScroll: () => void
  reset: () => void
}

const initialState = {
  messages: [
    {
      id: 'welcome',
      role: 'assistant' as const,
      content: '您好！我是您的智能助手。\n\n我可以帮您管理任务：打车、火车、飞机、会议、餐饮、酒店、事务等。\n\n直接告诉我您想做什么，我会理解您的需求。',
      timestamp: new Date(),
    },
  ],
  isLoading: false,
  inputText: '',
  scrollCounter: 0,
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,
  
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
  
  reset: () => set(initialState),
}))
