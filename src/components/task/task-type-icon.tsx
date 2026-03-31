/**
 * 任务类型图标组件
 * 根据任务类型显示对应图标
 */

import type { FC } from 'react'
import { Car, TrainFront, Plane, Building2, Utensils, Check, Calendar, Users } from 'lucide-react-taro'
import type { TaskType } from '@/types'
import { getTaskTypeColor, getTaskTypeName } from '@/types'

export interface TaskTypeIconProps {
  type: TaskType
  size?: number
  showLabel?: boolean
}

export const TaskTypeIcon: FC<TaskTypeIconProps> = ({ type, size = 20, showLabel = false }) => {
  const color = getTaskTypeColor(type)

  const renderIcon = () => {
    switch (type) {
      case 'taxi':
        return <Car size={size} color={color} />
      case 'train':
        return <TrainFront size={size} color={color} />
      case 'flight':
        return <Plane size={size} color={color} />
      case 'hotel':
        return <Building2 size={size} color={color} />
      case 'dining':
        return <Utensils size={size} color={color} />
      case 'meeting':
        return <Users size={size} color={color} />
      case 'todo':
        return <Check size={size} color={color} />
      default:
        return <Calendar size={size} color="#999" />
    }
  }

  if (showLabel) {
    return (
      <view className="flex items-center gap-1">
        {renderIcon()}
        <text className="text-xs" style={{ color }}>
          {getTaskTypeName(type)}
        </text>
      </view>
    )
  }

  return renderIcon()
}

export default TaskTypeIcon
