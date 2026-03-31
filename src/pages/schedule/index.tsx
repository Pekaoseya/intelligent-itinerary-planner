import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useMemo } from 'react'
import type { FC } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Calendar, Plus } from 'lucide-react-taro'
import { taskService } from '@/services'
import { Button } from '@/components/ui/button'
import { WeekCalendar, TaskCard, TaskDetailModal } from '@/components/task'
import type { Task } from '@/types'
import './index.css'

// =============================================
// 主组件
// =============================================

const SchedulePage: FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
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

  // 获取屏幕信息
  const systemInfo = Taro.getSystemInfoSync()
  const headerHeight = 180
  const tabBarHeight = 50  // TabBar 高度
  const bottomBarHeight = 52  // 底部操作栏高度
  const scrollViewHeight = systemInfo.windowHeight - headerHeight - tabBarHeight

  useDidShow(() => {
    fetchTasks()
  })

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      setLoading(true)
      const taskList = await taskService.getTasks()
      taskList.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
      setTasks(taskList)
    } catch (error) {
      console.error('[Schedule] 获取任务失败:', error)
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

  // 格式化日期字符串
  const formatDateStr = (date: Date): string => {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${month}月${day}日 ${weekdays[date.getDay()]}`
  }

  // 完成任务
  const completeTask = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as const } : t))
      Taro.showToast({ title: '已完成', icon: 'success' })
      setShowTaskDetail(false)
      setSelectedTask(null)
    } catch (error) {
      console.error('[Schedule] 完成失败:', error)
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
            await taskService.deleteTask(task.id)
            setTasks(prev => prev.filter(t => t.id !== task.id))
            setShowTaskDetail(false)
            setSelectedTask(null)
            Taro.showToast({ title: '已删除', icon: 'success' })
          } catch (error) {
            console.error('[Schedule] 删除失败:', error)
            Taro.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      },
    })
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
      status: 'in_progress' as const,
      metadata: { ...prev.metadata, ...mockData }
    } : null)
    Taro.showToast({ title: '叫车成功！', icon: 'success' })
  }

  // 统计
  const completedCount = selectedDateTasks.filter(t => t.status === 'completed').length
  const pendingCount = selectedDateTasks.filter(t => t.status !== 'completed').length

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
        <WeekCalendar
          tasks={tasks}
          selectedDate={selectedDate}
          currentWeekStart={currentWeekStart}
          onDateSelect={setSelectedDate}
          onWeekChange={setCurrentWeekStart}
        />

        {/* 选中日期显示 */}
        <View className="flex items-center justify-center py-2 px-4 bg-gray-50 border-t border-gray-100">
          <Calendar size={16} color="#1890ff" />
          <Text className="text-sm font-medium text-gray-700 ml-2">{formatDateStr(selectedDate)}</Text>
        </View>
      </View>

      {/* 任务列表 */}
      <ScrollView
        scrollY
        style={{
          height: `${scrollViewHeight}px`,
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden',
          backgroundColor: '#f5f5f5',
          boxSizing: 'border-box'
        }}
      >
        <View 
          className="px-3 py-3"
          style={{ 
            width: '100%', 
            maxWidth: '100vw', 
            minWidth: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            paddingBottom: `${bottomBarHeight + tabBarHeight + 20}px`
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
            <View className="flex flex-col gap-3" style={{ width: '100%', minWidth: 0 }}>
              {selectedDateTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onViewDetail={(t) => {
                    setSelectedTask(t)
                    setShowTaskDetail(true)
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 任务详情弹窗 */}
      <TaskDetailModal
        task={selectedTask}
        visible={showTaskDetail}
        onClose={() => {
          setShowTaskDetail(false)
          setSelectedTask(null)
        }}
        onComplete={completeTask}
        onDelete={deleteTask}
        onCallTaxi={handleCallTaxi}
      />

      {/* 底部操作栏 */}
      <View
        className="bg-white border-t border-gray-200 px-4 py-2"
        style={{
          position: 'fixed',
          bottom: tabBarHeight,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          backgroundColor: '#fff',
          zIndex: 100,
          boxSizing: 'border-box'
        }}
      >
        <Button className="w-full" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
          <Plus size={16} color="#fff" />
          <Text className="text-sm text-white ml-1">添加日程</Text>
        </Button>
      </View>
    </View>
  )
}

export default SchedulePage
