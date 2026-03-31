/**
 * 周历组件
 * 支持左右滑动切换周
 */

import { View, Text, Swiper, SwiperItem } from '@tarojs/components'
import { useMemo, useRef, useCallback, type FC } from 'react'
import Taro from '@tarojs/taro'
import type { TaskType } from '@/types'
import { getTaskTypeColor } from '@/types'

export interface WeekCalendarProps {
  tasks: Array<{
    id: string
    scheduled_time: string
    type: TaskType
  }>
  selectedDate: Date
  currentWeekStart: Date
  onDateSelect: (date: Date) => void
  onWeekChange: (weekStart: Date) => void
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

// 格式化日期为 YYYY-MM-DD
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取任务的本地日期字符串
const getTaskLocalDate = (scheduledTime: string): string => {
  const date = new Date(scheduledTime)
  return formatLocalDate(date)
}

export const WeekCalendar: FC<WeekCalendarProps> = ({
  tasks,
  selectedDate,
  currentWeekStart,
  onDateSelect,
  onWeekChange,
}) => {
  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
  const swiperCurrentRef = useRef(1)

  // 生成周数据
  const generateWeekDays = useCallback((weekStart: Date) => {
    const days: Array<{
      date: Date
      isToday: boolean
      isSelected: boolean
      hasTask: boolean
      taskTypes: TaskType[]
    }> = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      date.setHours(0, 0, 0, 0)

      const dateStr = formatLocalDate(date)
      const dayTasks = tasks.filter(t => getTaskLocalDate(t.scheduled_time) === dateStr)

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

  // Swiper 的三周数据
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
      onWeekChange(newWeekStart)
    } else if (newCurrent === 2 && prevCurrent === 1) {
      const newWeekStart = new Date(currentWeekStart)
      newWeekStart.setDate(currentWeekStart.getDate() + 7)
      onWeekChange(newWeekStart)
    }

    swiperCurrentRef.current = newCurrent

    setTimeout(() => {
      swiperCurrentRef.current = 1
      // 触发重新渲染
    }, 50)
  }, [currentWeekStart, onWeekChange])

  // 渲染单日
  const renderDay = (day: typeof currentWeekDays[0], idx: number) => (
    <View
      key={idx}
      className="flex-1 flex flex-col items-center justify-center py-1"
      style={{ minWidth: 0 }}
      onClick={() => onDateSelect(day.date)}
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
            <View key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: getTaskTypeColor(t) }} />
          ))}
        </View>
      )}
      {!day.hasTask && <View className="w-1 h-1" />}
    </View>
  )

  return (
    <View 
      className="w-full px-2 py-2"
      style={{ 
        maxWidth: '100vw',
        overflowX: 'hidden'
      }}
    >
      {/* 周几标签 */}
      <View className="flex items-center mb-2" style={{ width: '100%', minWidth: 0 }}>
        {WEEK_LABELS.map((label, idx) => (
          <View key={idx} className="flex-1 text-center" style={{ minWidth: 0 }}>
            <Text className={`text-xs ${idx === 0 || idx === 6 ? 'text-red-400' : 'text-gray-400'}`}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Swiper 周视图 - H5 端使用静态视图，小程序端使用 Swiper */}
      {isWeapp ? (
        <Swiper
          className="w-full"
          style={{ height: '56px', maxWidth: '100vw', overflowX: 'hidden' }}
          current={1}
          onChange={handleSwiperChange}
          duration={200}
        >
          {swiperWeeks.map((week) => (
            <SwiperItem key={week.key}>
              <View 
                className="flex items-center w-full"
                style={{ maxWidth: '100vw', overflowX: 'hidden' }}
              >
                {week.days.map((day, idx) => renderDay(day, idx))}
              </View>
            </SwiperItem>
          ))}
        </Swiper>
      ) : (
        <View 
          className="flex items-center w-full"
          style={{ maxWidth: '100vw', overflowX: 'hidden' }}
        >
          {currentWeekDays.map((day, idx) => renderDay(day, idx))}
        </View>
      )}
    </View>
  )
}

export default WeekCalendar
