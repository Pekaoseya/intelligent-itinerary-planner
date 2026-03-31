/**
 * 任务详情弹窗组件
 */

import { View, Text, ScrollView, Map } from '@tarojs/components'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Clock, MapPin, X, Navigation, Trash2, Car } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { getTaskTypeColor } from '@/types'
import type { Task } from '@/types'
import { TaskTypeIcon } from './task-type-icon'

export interface TaskDetailModalProps {
  task: Task | null
  visible: boolean
  onClose: () => void
  onComplete: (taskId: string) => void
  onDelete: (task: Task) => void
  onCallTaxi?: () => void
}

// 格式化时间
const formatTime = (timeStr?: string | null): string => {
  if (!timeStr) return '--:--'
  try {
    const date = new Date(timeStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } catch {
    return '--:--'
  }
}

// 格式化日期字符串
const formatDateStr = (date: Date): string => {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${month}月${day}日 ${weekdays[date.getDay()]}`
}

// 默认坐标（杭州西湖）
const DEFAULT_LOCATION = {
  latitude: 30.242489,
  longitude: 120.148532,
  name: '杭州西湖'
}

export const TaskDetailModal: FC<TaskDetailModalProps> = ({
  task,
  visible,
  onClose,
  onComplete,
  onDelete,
  onCallTaxi,
}) => {
  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  if (!visible || !task) return null

  const typeColor = getTaskTypeColor(task.type)
  const shouldShowMap = ['taxi', 'train', 'flight'].includes(task.type)

  // 地图标记点
  const getMapMarkers = () => {
    const markers: Array<{
      id: number
      latitude: number
      longitude: number
      title: string
      iconPath: string
      width: number
      height: number
    }> = []

    markers.push({
      id: 1,
      latitude: task.latitude || DEFAULT_LOCATION.latitude,
      longitude: task.longitude || DEFAULT_LOCATION.longitude,
      title: task.location_name || '起点',
      iconPath: './assets/marker-start.png',
      width: 24,
      height: 24,
    })

    markers.push({
      id: 2,
      latitude: task.dest_latitude || DEFAULT_LOCATION.latitude,
      longitude: task.dest_longitude || DEFAULT_LOCATION.longitude,
      title: task.destination_name || '终点',
      iconPath: './assets/marker-end.png',
      width: 24,
      height: 24,
    })

    return markers
  }

  // 地图线路
  const getMapPolyline = () => {
    if (task.metadata?.polyline && Array.isArray(task.metadata.polyline)) {
      return [{
        points: task.metadata.polyline,
        color: '#1890ff',
        width: 4,
        arrowLine: true,
      }]
    }

    return [{
      points: [
        { latitude: task.latitude || DEFAULT_LOCATION.latitude, longitude: task.longitude || DEFAULT_LOCATION.longitude },
        { latitude: task.dest_latitude || DEFAULT_LOCATION.latitude, longitude: task.dest_longitude || DEFAULT_LOCATION.longitude },
      ],
      color: '#1890ff',
      width: 4,
      arrowLine: true,
    }]
  }

  return (
    <View
      className="fixed inset-0 z-50"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        maxWidth: '100vw',
        backgroundColor: 'rgba(0,0,0,0.5)',
        overflowX: 'hidden'
      }}
    >
      <View
        className="absolute left-0 right-0 bg-white rounded-t-2xl"
        style={{
          bottom: 0,
          width: '100%',
          maxWidth: '100vw',
          maxHeight: '85vh',
          overflowX: 'hidden',
          paddingBottom: '60px'
        }}
      >
        {/* 弹窗头部 */}
        <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <View className="flex items-center gap-2">
            <View
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${typeColor}15` }}
            >
              <TaskTypeIcon type={task.type} size={20} />
            </View>
            <Text className="text-lg font-bold">{task.title}</Text>
          </View>
          <Button size="sm" variant="ghost" className="p-1" onClick={onClose}>
            <X size={24} color="#999" />
          </Button>
        </View>

        {/* 内容 */}
        <ScrollView scrollY className="p-4" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', maxHeight: '65vh' }}>
          {/* 地图展示 - 出行任务 */}
          {shouldShowMap && (
            <View className="mb-4" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
              {isWeapp ? (
                <Map
                  className="w-full rounded-xl"
                  style={{ height: '180px', width: '100%', maxWidth: '100%' }}
                  longitude={task.longitude || DEFAULT_LOCATION.longitude}
                  latitude={task.latitude || DEFAULT_LOCATION.latitude}
                  scale={12}
                  markers={getMapMarkers()}
                  polyline={getMapPolyline()}
                  showLocation={false}
                  enableZoom
                  enableScroll
                  enableRotate={false}
                  onError={() => {}}
                />
              ) : (
                <View className="w-full h-44 rounded-xl bg-gray-100 flex items-center justify-center" style={{ maxWidth: '100vw' }}>
                  <View className="flex flex-col items-center">
                    <Navigation size={32} color="#1890ff" />
                    <Text className="text-sm text-gray-500 mt-2" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
                      {task.location_name || '--'} → {task.destination_name || '--'}
                    </Text>
                    {task.metadata?.distance !== undefined && (
                      <Text className="text-xs text-gray-400 mt-1">
                        约 {((task.metadata.distance as number) / 1000).toFixed(1)} 公里
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* 路程信息 */}
              <View className="flex items-center justify-around mt-3 py-2 bg-gray-50 rounded-lg" style={{ width: '100%', maxWidth: '100vw' }}>
                {task.metadata?.distance !== undefined && (
                  <View className="flex flex-col items-center">
                    <Text className="text-lg font-bold text-blue-500">
                      {((task.metadata.distance as number) / 1000).toFixed(1)}km
                    </Text>
                    <Text className="text-xs text-gray-500">距离</Text>
                  </View>
                )}
                {task.metadata?.duration !== undefined && (
                  <View className="flex flex-col items-center">
                    <Text className="text-lg font-bold text-green-500">
                      {Math.round((task.metadata.duration as number) / 60)}分钟
                    </Text>
                    <Text className="text-xs text-gray-500">预计</Text>
                  </View>
                )}
                {task.metadata?.cost !== undefined && (
                  <View className="flex flex-col items-center">
                    <Text className="text-lg font-bold text-orange-500">
                      ¥{task.metadata.cost as string | number}
                    </Text>
                    <Text className="text-xs text-gray-500">预估费用</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 时间地点 */}
          <View className="mb-4">
            <View className="flex items-center gap-2 mb-2">
              <Clock size={16} color="#1890ff" />
              <Text className="text-sm">{formatDateStr(new Date(task.scheduled_time))} {formatTime(task.scheduled_time)}</Text>
            </View>
            {task.destination_name && (
              <View className="flex items-start gap-2">
                <MapPin size={16} color="#52c41a" />
                <Text className="text-sm text-gray-600">{task.destination_name}</Text>
              </View>
            )}
            {task.location_name && (
              <View className="flex items-start gap-2 mt-1">
                <MapPin size={16} color="#faad14" />
                <Text className="text-sm text-gray-600">{task.location_name}</Text>
              </View>
            )}
          </View>

          {/* 操作按钮 */}
          {task.status !== 'completed' && (
            <View className="flex gap-3 mt-4">
              <Button className="flex-1" onClick={() => onComplete(task.id)}>
                <Text className="text-white">完成任务</Text>
              </Button>
              {task.type === 'taxi' && task.status === 'pending' && onCallTaxi && (
                <Button variant="outline" className="flex-1" onClick={onCallTaxi}>
                  <Car size={16} color="#1890ff" />
                  <Text className="text-blue-500 ml-1">叫车</Text>
                </Button>
              )}
              <Button variant="ghost" onClick={() => onDelete(task)}>
                <Trash2 size={20} color="#ff4d4f" />
              </Button>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  )
}

export default TaskDetailModal
