/**
 * 用户位置相关类型定义
 */

// 用户位置
export interface UserLocation {
  latitude: number
  longitude: number
  name?: string
}

// 默认位置（杭州西湖）
export const DEFAULT_LOCATION: UserLocation = {
  latitude: 30.242489,
  longitude: 120.148532,
  name: '杭州西湖',
}
