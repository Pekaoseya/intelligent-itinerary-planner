/**
 * 定位状态管理
 */
import { create } from 'zustand'

export interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

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
  
  setLocation: (location) => set({ location, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setShowDetail: (show) => set({ showDetail: show }),
  reset: () => set(initialState),
}))
