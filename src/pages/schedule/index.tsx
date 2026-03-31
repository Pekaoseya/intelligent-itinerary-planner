import { View, Text, ScrollView, Swiper, SwiperItem, Map } from '@tarojs/components'
import { useState, useMemo, useRef, useCallback } from 'react'
import type { FC } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Calendar, MapPin, Car, TrainFront, Plane, Building2, Utensils, Check, Plus, Users, Clock, Trash2, Phone, X, Navigation } from 'lucide-react-taro'
import { Network } from '@/network'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import './index.css'

// =============================================
// 类型定义
// =============================================

type TaskType = 'taxi' | 'train' | 'flight' | 'meeting' | 'dining' | 'hotel' | 'todo' | 'other'
type TaskStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'expired'

interface Task {
  id: string
  title: string
  type: TaskType
  status: TaskStatus
  scheduled_time: string
  end_time?: string
  location_name?: string
  destination_name?: string
  latitude?: number
  longitude?: number
  dest_latitude?: number
  dest_longitude?: number
  is_expired: boolean
  metadata?: {
    train_number?: string
    flight_number?: string
    seat_type?: string
    cost?: number
    duration?: number
    attendees?: string[]
    meeting_room?: string
    tip?: string
    driver_name?: string
    driver_phone?: string
    car_number?: string
    car_model?: string
    arrive_minutes?: number
    distance?: number
    polyline?: Array<{ latitude: number; longitude: number }>
    [key: string]: any
  }
}

// =============================================
// 主组件
// =============================================

const SchedulePage: FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number
    longitude: number
    name: string
  }>({
    latitude: 30.242489,  // 默认杭州西湖
    longitude: 120.148532,
    name: '杭州西湖'
  })
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayOfWeek = today.getDay()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - dayOfWeek)
    return startOfWeek
  })
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const swiperCurrentRef = useRef(1)
  const [swiperKey, setSwiperKey] = useState(0)
  
  // 底部偏移 - 设为0，由系统自动处理
  // 注意：小程序 TabBar 会自动预留空间，fixed 元素 bottom: 0 即可
  const bottomOffset = 0
  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
  
  // 获取屏幕信息，用于计算 ScrollView 高度
  // 小程序端 ScrollView 需要明确高度，flex-1 不生效
  const systemInfo = Taro.getSystemInfoSync()
  const headerHeight = 180 // 头部区域大约高度（px）
  const scrollViewHeight = systemInfo.windowHeight - headerHeight

  useDidShow(() => {
    fetchTasks()
    getCurrentLocation()
  })

  // 获取当前位置
  // 如果获取失败，使用默认值（杭州西湖）
  const getCurrentLocation = async () => {
    try {
      const res = await Taro.getLocation({ type: 'gcj02' })
      setCurrentLocation({
        latitude: res.latitude,
        longitude: res.longitude,
        name: '当前位置'
      })
      console.log('获取定位成功:', res.latitude, res.longitude)
    } catch (error) {
      console.warn('获取定位失败，使用默认值（杭州西湖）:', error)
      // 保持默认值不变
    }
  }

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: '/api/tasks', method: 'GET' })
      const taskList: Task[] = res.data?.data || []
      taskList.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
      setTasks(taskList)
    } catch (error) {
      console.error('获取任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取选中日期的任务
  const selectedDateTasks = useMemo(() => {
    return tasks.filter(task => {
      const taskDate = new Date(task.scheduled_time)
      return (
        taskDate.getFullYear() === selectedDate.getFullYear() &&
        taskDate.getMonth() === selectedDate.getMonth() &&
        taskDate.getDate() === selectedDate.getDate()
      )
    })
  }, [tasks, selectedDate])

  // 格式化日期为 YYYY-MM-DD
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 获取任务的本地日期字符串
  const getTaskLocalDate = (task: Task): string => {
    const date = new Date(task.scheduled_time)
    return formatLocalDate(date)
  }

  // 生成周数据
  const generateWeekDays = useCallback((weekStart: Date) => {
    const days: { date: Date; isToday: boolean; isSelected: boolean; hasTask: boolean; taskTypes: TaskType[] }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      date.setHours(0, 0, 0, 0)
      
      const dateStr = formatLocalDate(date)
      const dayTasks = tasks.filter(t => getTaskLocalDate(t) === dateStr)
      
      days.push({
        date: new Date(date),
        isToday: date.getTime() === today.getTime(),
        isSelected: date.getFullYear() === selectedDate.getFullYear() && 
                    date.getMonth() === selectedDate.getMonth() && 
                    date.getDate() === selectedDate.getDate(),
        hasTask: dayTasks.length > 0,
        taskTypes: [...new Set(dayTasks.map(t => t.type))],
      })
    }
    return days
  }, [tasks, selectedDate])

  // 当前周数据
  const currentWeekDays = useMemo(() => generateWeekDays(currentWeekStart), [currentWeekStart, generateWeekDays])

  // 生成 Swiper 的三周数据
  const swiperWeeks = useMemo(() => {
    const prevWeekStart = new Date(currentWeekStart)
    prevWeekStart.setDate(currentWeekStart.getDate() - 7)
    
    const nextWeekStart = new Date(currentWeekStart)
    nextWeekStart.setDate(currentWeekStart.getDate() + 7)
    
    return [
      { key: `prev-${prevWeekStart.getTime()}`, days: generateWeekDays(prevWeekStart) },
      { key: `current-${currentWeekStart.getTime()}`, days: currentWeekDays },
      { key: `next-${nextWeekStart.getTime()}`, days: generateWeekDays(nextWeekStart) },
    ]
  }, [currentWeekStart, currentWeekDays, generateWeekDays])

  // Swiper 滑动处理
  const handleSwiperChange = useCallback((e: { detail: { current: number } }) => {
    const newCurrent = e.detail.current
    const prevCurrent = swiperCurrentRef.current
    
    if (newCurrent === 0 && prevCurrent === 1) {
      const newWeekStart = new Date(currentWeekStart)
      newWeekStart.setDate(currentWeekStart.getDate() - 7)
      setCurrentWeekStart(newWeekStart)
    } else if (newCurrent === 2 && prevCurrent === 1) {
      const newWeekStart = new Date(currentWeekStart)
      newWeekStart.setDate(currentWeekStart.getDate() + 7)
      setCurrentWeekStart(newWeekStart)
    }
    
    swiperCurrentRef.current = newCurrent
    
    setTimeout(() => {
      swiperCurrentRef.current = 1
      setSwiperKey(prev => prev + 1)
    }, 50)
  }, [currentWeekStart])

  // 点击日期
  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  // 格式化时间
  const formatTime = (timeStr?: string | null): string => {
    if (!timeStr) return '--:--'
    try {
      const date = new Date(timeStr)
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    } catch { return '--:--' }
  }

  // 格式化日期字符串
  const formatDateStr = (date: Date): string => {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${month}月${day}日 ${weekdays[date.getDay()]}`
  }

  // 获取类型图标
  const getTypeIcon = (type: TaskType, size = 20) => {
    switch (type) {
      case 'taxi': return <Car size={size} color="#faad14" />
      case 'train': return <TrainFront size={size} color="#1890ff" />
      case 'flight': return <Plane size={size} color="#722ed1" />
      case 'hotel': return <Building2 size={size} color="#722ed1" />
      case 'dining': return <Utensils size={size} color="#faad14" />
      case 'meeting': return <Users size={size} color="#1890ff" />
      case 'todo': return <Check size={size} color="#52c41a" />
      default: return <Calendar size={size} color="#999" />
    }
  }

  // 获取类型颜色
  const getTypeColor = (type: TaskType): string => {
    const colors: Record<TaskType, string> = {
      taxi: '#faad14', train: '#1890ff', flight: '#722ed1',
      hotel: '#722ed1', dining: '#faad14', meeting: '#1890ff',
      todo: '#52c41a', other: '#999',
    }
    return colors[type] || '#999'
  }

  // 获取类型名称
  const getTypeName = (type: TaskType): string => {
    const names: Record<TaskType, string> = {
      taxi: '打车', train: '高铁', flight: '飞机',
      hotel: '酒店', dining: '用餐', meeting: '会议',
      todo: '事务', other: '其他',
    }
    return names[type] || '任务'
  }

  // 完成任务
  const completeTask = async (taskId: string) => {
    try {
      await Network.request({
        url: `/api/tasks/${taskId}/complete`,
        method: 'GET',
      })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as TaskStatus } : t))
      Taro.showToast({ title: '已完成', icon: 'success' })
      setShowTaskDetail(false)
      setSelectedTask(null)
    } catch (error) {
      console.error('完成失败:', error)
    }
  }

  // 删除任务
  const deleteTask = async (task: Task) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除「${task.title}」吗？`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/tasks/${task.id}`,
              method: 'DELETE',
            })
            setTasks(prev => prev.filter(t => t.id !== task.id))
            setShowTaskDetail(false)
            setSelectedTask(null)
            Taro.showToast({ title: '已删除', icon: 'success' })
          } catch (error) {
            console.error('删除失败:', error)
            Taro.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      },
    })
  }

  // 查看任务详情
  const viewTaskDetail = (task: Task) => {
    setSelectedTask(task)
    setShowTaskDetail(true)
  }

  // 叫车
  const handleCallTaxi = async () => {
    if (!selectedTask) return
    const mockData = {
      driver_name: '张师傅',
      driver_phone: '138****8888',
      car_number: '京A·88888',
      car_model: '大众帕萨特',
      arrive_minutes: 3,
    }
    setSelectedTask(prev => prev ? { 
      ...prev, 
      status: 'in_progress' as TaskStatus,
      metadata: { ...prev.metadata, ...mockData } 
    } : null)
    Taro.showToast({ title: '叫车成功！', icon: 'success' })
  }

  // 统计
  const completedCount = selectedDateTasks.filter(t => t.status === 'completed').length
  const pendingCount = selectedDateTasks.filter(t => t.status !== 'completed').length

  // 周几标签
  const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

  // 默认坐标（杭州西湖）
  // 如果无法获取定位或任务没有坐标，使用杭州西湖作为默认值
  // 备注：杭州西湖 经度 120.148532, 纬度 30.242489
  const DEFAULT_LOCATION = {
    latitude: 30.242489,
    longitude: 120.148532,
    name: '杭州西湖'
  }
  
  // 地图标记点
  const getMapMarkers = (task: Task) => {
    // 优先使用任务坐标，其次使用当前定位，最后使用默认值
    const defaultLat = currentLocation.latitude || DEFAULT_LOCATION.latitude
    const defaultLng = currentLocation.longitude || DEFAULT_LOCATION.longitude
    
    const markers: Array<{
      id: number
      latitude: number
      longitude: number
      title: string
      iconPath: string
      width: number
      height: number
    }> = []
    
    // 起点标记
    markers.push({
      id: 1,
      latitude: task.latitude || defaultLat,
      longitude: task.longitude || defaultLng,
      title: task.location_name || '起点',
      iconPath: './assets/marker-start.png',
      width: 24,
      height: 24,
    })
    
    // 终点标记
    markers.push({
      id: 2,
      latitude: task.dest_latitude || defaultLat,
      longitude: task.dest_longitude || defaultLng,
      title: task.destination_name || '终点',
      iconPath: './assets/marker-end.png',
      width: 24,
      height: 24,
    })
    
    return markers
  }

  // 地图线路
  const getMapPolyline = (task: Task) => {
    const defaultLat = DEFAULT_LOCATION.latitude
    const defaultLng = DEFAULT_LOCATION.longitude
    
    const startLat = task.latitude || defaultLat
    const startLng = task.longitude || defaultLng
    const endLat = task.dest_latitude || defaultLat
    const endLng = task.dest_longitude || defaultLng
    
    // 如果有后端返回的 polyline，使用它
    if (task.metadata?.polyline && task.metadata.polyline.length > 0) {
      return [{
        points: task.metadata.polyline,
        color: '#1890ff',
        width: 4,
        arrowLine: true,
      }]
    }
    
    // 否则使用直线（起点到终点）
    return [{
      points: [
        { latitude: startLat, longitude: startLng },
        { latitude: endLat, longitude: endLng },
      ],
      color: '#1890ff',
      width: 4,
      arrowLine: true,
    }]
  }

  // 判断是否需要显示地图 - 出行任务直接显示
  const shouldShowMap = (task: Task) => {
    return ['taxi', 'train', 'flight'].includes(task.type)
  }

  return (
    <View 
      className="flex flex-col bg-gray-50"
      style={{ width: '100%', maxWidth: '100vw', height: '100%', backgroundColor: '#f5f5f5', boxSizing: 'border-box', overflow: 'hidden', overflowX: 'hidden' }}
    >
      {/* 头部 */}
      <View className="flex-shrink-0 w-full bg-white border-b border-gray-200 box-border">
        {/* 标题栏 */}
        <View className="flex items-center justify-between px-4 py-3 w-full">
          <Text className="text-lg font-bold">我的日程</Text>
          <View className="flex items-center gap-2">
            <View className="px-2 py-1 rounded-full bg-green-100">
              <Text className="text-xs text-green-600">完成 {completedCount}</Text>
            </View>
            <View className="px-2 py-1 rounded-full bg-blue-100">
              <Text className="text-xs text-blue-600">待办 {pendingCount}</Text>
            </View>
          </View>
        </View>

        {/* 周历导航 */}
        <View className="w-full px-2 py-2">
          {/* 周几标签 */}
          <View className="flex items-center mb-2">
            {weekLabels.map((label, idx) => (
              <View key={idx} className="flex-1 text-center">
                <Text className={`text-xs ${idx === 0 || idx === 6 ? 'text-red-400' : 'text-gray-400'}`}>{label}</Text>
              </View>
            ))}
          </View>
          
          {/* Swiper 周视图 - H5 端使用 ScrollView，小程序端使用 Swiper */}
          {isWeapp ? (
            <Swiper
              key={swiperKey}
              className="w-full"
              style={{ height: '56px' }}
              current={1}
              onChange={handleSwiperChange}
              duration={200}
            >
              {swiperWeeks.map((week) => (
                <SwiperItem key={week.key}>
                  <View className="flex items-center w-full">
                    {week.days.map((day, idx) => (
                      <View 
                        key={idx} 
                        className="flex-1 flex flex-col items-center justify-center py-1"
                        onClick={() => handleDateClick(day.date)}
                      >
                        {/* 日期数字 */}
                        <View 
                          className={`w-9 h-9 rounded-full flex items-center justify-center mb-1 ${
                            day.isSelected ? 'bg-blue-500' : day.isToday ? 'bg-blue-100' : ''
                          }`}
                        >
                          <Text 
                            className={`text-base font-medium ${
                              day.isSelected ? 'text-white' : day.isToday ? 'text-blue-500 font-bold' : 'text-gray-700'
                            }`}
                          >
                            {day.date.getDate()}
                          </Text>
                        </View>
                        
                        {/* 任务指示点 */}
                        {day.hasTask && (
                          <View className="flex gap-1">
                            {day.taskTypes.slice(0, 3).map((t, i) => (
                              <View key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: getTypeColor(t) }} />
                            ))}
                          </View>
                        )}
                        {!day.hasTask && <View className="w-1 h-1" />}
                      </View>
                    ))}
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          ) : (
            /* H5 端降级：只显示当前周 */
            <View className="flex items-center w-full">
              {currentWeekDays.map((day, idx) => (
                <View 
                  key={idx} 
                  className="flex-1 flex flex-col items-center justify-center py-1"
                  onClick={() => handleDateClick(day.date)}
                >
                  <View 
                    className={`w-9 h-9 rounded-full flex items-center justify-center mb-1 ${
                      day.isSelected ? 'bg-blue-500' : day.isToday ? 'bg-blue-100' : ''
                    }`}
                  >
                    <Text 
                      className={`text-base font-medium ${
                        day.isSelected ? 'text-white' : day.isToday ? 'text-blue-500 font-bold' : 'text-gray-700'
                      }`}
                    >
                      {day.date.getDate()}
                    </Text>
                  </View>
                  {day.hasTask && (
                    <View className="flex gap-1">
                      {day.taskTypes.slice(0, 3).map((t, i) => (
                        <View key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: getTypeColor(t) }} />
                      ))}
                    </View>
                  )}
                  {!day.hasTask && <View className="w-1 h-1" />}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 选中日期显示 */}
        <View className="flex items-center justify-center py-2 px-4 bg-gray-50 border-t border-gray-100">
          <Calendar size={16} color="#1890ff" />
          <Text className="text-sm font-medium text-gray-700 ml-2">{formatDateStr(selectedDate)}</Text>
        </View>
      </View>

      {/* 任务列表 - 根据平台调整底部 padding */}
      <ScrollView 
        scrollY 
        className="p-3" 
        style={{ 
          height: `${scrollViewHeight}px`, 
          width: '100%', 
          maxWidth: '100vw',
          overflowX: 'hidden',
          backgroundColor: '#f5f5f5',
          paddingBottom: `${bottomOffset + 60}px`
        }}
      >
        {loading ? (
          <View className="flex items-center justify-center py-12">
            <Text className="text-gray-400">加载中...</Text>
          </View>
        ) : selectedDateTasks.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Calendar className="text-gray-300 mb-3" size={48} />
            <Text className="block text-gray-500 mb-2">这天暂无日程</Text>
            <Button size="sm" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
              <Plus size={16} color="#fff" />
              <Text className="text-sm text-white ml-1">添加日程</Text>
            </Button>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {selectedDateTasks.map((task) => (
              <Card key={task.id} className={`rounded-xl overflow-hidden ${task.status === 'completed' ? 'opacity-60' : ''} ${task.is_expired ? 'border-red-200' : ''}`} style={{ maxWidth: '100vw' }}>
                <CardContent className="p-0" style={{ maxWidth: '100%' }}>
                  <View className="flex items-start p-3" style={{ maxWidth: '100%' }}>
                    <View className="flex flex-col items-center mr-3" style={{ width: '50px', flexShrink: 0 }}>
                      <Text className="text-sm font-medium text-gray-700">{formatTime(task.scheduled_time)}</Text>
                      <View className="w-10 h-10 rounded-full flex items-center justify-center mt-2" style={{ backgroundColor: `${getTypeColor(task.type)}15` }}>
                        {task.status === 'completed' ? <Check size={20} color="#52c41a" /> : getTypeIcon(task.type)}
                      </View>
                    </View>
                    <View className="flex-1" style={{ minWidth: 0, maxWidth: '100%' }}>
                      <View className="flex items-center gap-2 mb-1" style={{ flexWrap: 'wrap' }}>
                        <Text className={`text-base font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`} style={{ wordBreak: 'break-all' }}>{task.title}</Text>
                        <View className="px-2 py-1 rounded" style={{ backgroundColor: `${getTypeColor(task.type)}15` }}>
                          <Text className="text-xs" style={{ color: getTypeColor(task.type) }}>{getTypeName(task.type)}</Text>
                        </View>
                        {task.is_expired && (
                          <View className="px-2 py-1 rounded bg-red-100">
                            <Text className="text-xs text-red-500">已过期</Text>
                          </View>
                        )}
                      </View>
                      {task.destination_name && <Text className="text-xs text-gray-500 mb-1" style={{ wordBreak: 'break-all' }}>{task.destination_name}</Text>}
                      {task.location_name && (
                        <View className="flex items-center gap-1">
                          <MapPin size={12} color="#999" />
                          <Text className="text-xs text-gray-400" style={{ wordBreak: 'break-all' }}>{task.location_name}</Text>
                        </View>
                      )}
                    </View>
                    <View className="ml-2 flex gap-1" style={{ flexShrink: 0 }}>
                      <Button size="sm" className="rounded-full px-3" onClick={() => viewTaskDetail(task)}>
                        <Text className="text-xs text-white">{task.status === 'completed' ? '详情' : '操作'}</Text>
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 任务详情弹窗 */}
      {showTaskDetail && selectedTask && (
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
              paddingBottom: '60px'  // 预留 TabBar 高度
            }}
          >
            {/* 弹窗头部 */}
            <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <View className="flex items-center gap-2">
                <View className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${getTypeColor(selectedTask.type)}15` }}>
                  {getTypeIcon(selectedTask.type, 20)}
                </View>
                <Text className="text-lg font-bold">{selectedTask.title}</Text>
              </View>
              <Button size="sm" variant="ghost" className="p-1" onClick={() => { setShowTaskDetail(false); setSelectedTask(null) }}>
                <X size={24} color="#999" />
              </Button>
            </View>

            {/* 内容 */}
            <ScrollView scrollY className="p-4" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', maxHeight: '65vh' }}>
              {/* 地图展示 - 出行任务 */}
              {shouldShowMap(selectedTask) && (
                <View className="mb-4" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
                  {isWeapp ? (
                    <Map
                      className="w-full rounded-xl"
                      style={{ height: '180px', width: '100%', maxWidth: '100%' }}
                      longitude={selectedTask.longitude || currentLocation.longitude || DEFAULT_LOCATION.longitude}
                      latitude={selectedTask.latitude || currentLocation.latitude || DEFAULT_LOCATION.latitude}
                      scale={12}
                      markers={getMapMarkers(selectedTask)}
                      polyline={getMapPolyline(selectedTask)}
                      showLocation={false}
                      enableZoom
                      enableScroll
                      enableRotate={false}
                      onError={(e) => { console.error('地图加载失败:', e) }}
                    />
                  ) : (
                    <View className="w-full h-44 rounded-xl bg-gray-100 flex items-center justify-center" style={{ maxWidth: '100vw' }}>
                      <View className="flex flex-col items-center">
                        <Navigation size={32} color="#1890ff" />
                        <Text className="text-sm text-gray-500 mt-2" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
                          {selectedTask.location_name || '--'} → {selectedTask.destination_name || '--'}
                        </Text>
                        {selectedTask.metadata?.distance && (
                          <Text className="text-xs text-gray-400 mt-1">
                            约 {(selectedTask.metadata.distance / 1000).toFixed(1)} 公里
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                  
                  {/* 路程信息 */}
                  <View className="flex items-center justify-around mt-3 py-2 bg-gray-50 rounded-lg" style={{ width: '100%', maxWidth: '100vw' }}>
                    {selectedTask.metadata?.distance && (
                      <View className="flex flex-col items-center">
                        <Text className="text-lg font-bold text-blue-500">
                          {(selectedTask.metadata.distance / 1000).toFixed(1)}km
                        </Text>
                        <Text className="text-xs text-gray-500">距离</Text>
                      </View>
                    )}
                    {selectedTask.metadata?.duration && (
                      <View className="flex flex-col items-center">
                        <Text className="text-lg font-bold text-green-500">
                          {Math.round(selectedTask.metadata.duration / 60)}分钟
                        </Text>
                        <Text className="text-xs text-gray-500">预计</Text>
                      </View>
                    )}
                    {selectedTask.metadata?.cost && (
                      <View className="flex flex-col items-center">
                        <Text className="text-lg font-bold text-orange-500">
                          ¥{selectedTask.metadata.cost}
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
                  <Text className="text-sm">{formatDateStr(new Date(selectedTask.scheduled_time))} {formatTime(selectedTask.scheduled_time)}</Text>
                </View>
                {selectedTask.destination_name && (
                  <View className="flex items-start gap-2">
                    <MapPin size={16} color="#52c41a" />
                    <Text className="text-sm text-gray-600">{selectedTask.destination_name}</Text>
                  </View>
                )}
                {selectedTask.location_name && (
                  <View className="flex items-start gap-2 mt-1">
                    <MapPin size={16} color="#faad14" />
                    <Text className="text-sm text-gray-600">{selectedTask.location_name}</Text>
                  </View>
                )}
              </View>

              {/* 车次/航班信息 */}
              {(selectedTask.metadata?.train_number || selectedTask.metadata?.flight_number) && (
                <Card className="mb-4" style={{ maxWidth: '100vw', overflow: 'hidden' }}>
                  <CardContent className="p-3" style={{ maxWidth: '100%' }}>
                    <View className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                      {selectedTask.metadata.train_number && (
                        <View className="px-3 py-2 rounded-lg bg-blue-100">
                          <Text className="text-lg font-bold text-blue-600">{selectedTask.metadata.train_number}</Text>
                        </View>
                      )}
                      {selectedTask.metadata.flight_number && (
                        <View className="px-3 py-2 rounded-lg bg-purple-100">
                          <Text className="text-lg font-bold text-purple-600">{selectedTask.metadata.flight_number}</Text>
                        </View>
                      )}
                      {selectedTask.metadata.seat_type && (
                        <Text className="text-sm text-gray-500">{selectedTask.metadata.seat_type}</Text>
                      )}
                    </View>
                    {selectedTask.metadata.tip && <Text className="text-xs text-blue-500 mt-2" style={{ wordBreak: 'break-all' }}>{selectedTask.metadata.tip}</Text>}
                  </CardContent>
                </Card>
              )}

              {/* 打车进行中显示司机信息 */}
              {selectedTask.type === 'taxi' && selectedTask.status === 'in_progress' && (
                <Card className="mb-4 bg-green-50">
                  <CardContent className="p-3">
                    <View className="flex items-center justify-between mb-2">
                      <View className="flex items-center gap-2">
                        <View className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                          <Car size={20} color="#fff" />
                        </View>
                        <View>
                          <Text className="text-sm font-medium">{selectedTask.metadata?.driver_name || '张师傅'}</Text>
                          <Text className="text-xs text-gray-500">{selectedTask.metadata?.car_model || '大众帕萨特'}</Text>
                        </View>
                      </View>
                      <View className="text-right">
                        <Text className="text-xs text-gray-500">预计到达</Text>
                        <Text className="text-lg font-bold text-green-600">{selectedTask.metadata?.arrive_minutes || 3}分钟</Text>
                      </View>
                    </View>
                    <View className="flex items-center justify-between pt-2 border-t border-green-200">
                      <Text className="text-sm font-bold">{selectedTask.metadata?.car_number || '京A·88888'}</Text>
                      <Button size="sm" onClick={() => Taro.makePhoneCall({ phoneNumber: selectedTask.metadata?.driver_phone || '13888888888' })}>
                        <Phone size={14} color="#fff" />
                        <Text className="text-xs text-white ml-1">联系司机</Text>
                      </Button>
                    </View>
                  </CardContent>
                </Card>
              )}

              {/* 操作按钮 */}
              {selectedTask.status !== 'completed' && selectedTask.status !== 'expired' && (
                <View className="flex gap-2 mb-4">
                  {selectedTask.type === 'taxi' && selectedTask.status !== 'in_progress' && (
                    <Button className="flex-1" onClick={handleCallTaxi}>
                      <Car size={16} color="#fff" />
                      <Text className="text-sm text-white ml-1">立即叫车</Text>
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => completeTask(selectedTask.id)}>
                    <Check size={16} color="#52c41a" />
                    <Text className="text-sm ml-1">标记完成</Text>
                  </Button>
                </View>
              )}

              {/* 删除按钮 */}
              <Button variant="outline" className="w-full border-red-200" onClick={() => deleteTask(selectedTask)}>
                <Trash2 size={16} color="#ff4d4f" />
                <Text className="text-sm text-red-500 ml-1">删除此日程</Text>
              </Button>
            </ScrollView>
          </View>
        </View>
      )}

      {/* 底部操作栏 */}
      <View 
        className="bg-white border-t border-gray-200 px-4 py-2 flex gap-2" 
        style={{ 
          position: 'fixed', 
          bottom: `${bottomOffset}px`, 
          left: 0, 
          right: 0,
          backgroundColor: '#fff',
          zIndex: 100
        }}
      >
        <Button className="flex-1" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
          <Plus size={16} color="#fff" />
          <Text className="text-sm text-white ml-1">添加日程</Text>
        </Button>
      </View>
    </View>
  )
}

export default SchedulePage
