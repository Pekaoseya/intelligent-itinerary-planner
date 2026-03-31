/**
 * 定位状态管理
 * 管理用户位置相关状态
 */
import { create } from 'zustand'

// =============================================
// 类型定义
// =============================================

export interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

// =============================================
// Store 定义
// =============================================

interface LocationState {
  // 状态
  location: UserLocation | null
  loading: boolean
  error: string | null
  showDetail: boolean
  
  // Actions
  setLocation: (location: UserLocation | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setShowDetail: (show: boolean) => void
  reset: () => void
}

const initialState = {
  location: null,
  loading: true,
  error: null,
  showDetail: false,
}

export const useLocationStore = create<LocationState>((set) => ({
  ...initialState,
  
  setLocation: (location) => set({ location, loading: false, error: null }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error, loading: false }),
  
  setShowDetail: (show) => set({ showDetail: show }),
  
  reset: () => set(initialState),
}))
