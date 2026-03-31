/**
 * 确认弹窗容器组件
 * 根据 type 渲染不同的确认组件
 */

import { View } from '@tarojs/components'
import { type FC } from 'react'
import { ConfirmAdd } from './confirm-add'
import { ConfirmModify } from './confirm-modify'
import { ConfirmDelete } from './confirm-delete'
import type { ConfirmType, PendingTask } from './types'

export interface ConfirmModalProps {
  type: ConfirmType
  task: PendingTask
  originalTask?: PendingTask    // 修改时的原任务
  visible: boolean
  createdCount?: number          // 批量创建的任务数量
  onConfirm: (task: PendingTask) => void
  onCancel: () => void
}

export const ConfirmModal: FC<ConfirmModalProps> = ({
  type,
  task,
  originalTask,
  visible,
  createdCount,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null

  // 根据类型渲染不同的确认组件
  const renderContent = () => {
    switch (type) {
      case 'add':
        return (
          <ConfirmAdd
            task={task}
            createdCount={createdCount}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )
      case 'modify':
        return (
          <ConfirmModify
            task={task}
            originalTask={originalTask}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )
      case 'delete':
        return (
          <ConfirmDelete
            task={task}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )
      default:
        return null
    }
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
          paddingBottom: '20px'
        }}
      >
        {renderContent()}
      </View>
    </View>
  )
}

export default ConfirmModal
