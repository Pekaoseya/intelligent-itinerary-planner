/**
 * 反馈弹窗组件
 */

import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { feedbackService } from '@/services/feedback.service'

interface FeedbackModalProps {
  visible: boolean
  messages?: any[]
  userInfo?: any
  onClose: () => void
}

export function FeedbackModal({ visible, messages = [], userInfo, onClose }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('bug')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!description.trim()) {
      // 提示用户输入描述
      return
    }

    setSubmitting(true)

    try {
      await feedbackService.submitFeedback({
        userId: 'default-user',
        type: feedbackType,
        description,
        messages,
        userInfo: {
          location: userInfo,
          timestamp: new Date().toISOString(),
        },
      })

      // 提示成功
      setDescription('')
      onClose()
    } catch (error) {
      console.error('[FeedbackModal] 提交反馈失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={visible} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>提交反馈</DialogTitle>
        </DialogHeader>

        <View className="space-y-4">
          {/* 反馈类型选择 */}
          <View>
            <Text className="block text-sm font-medium mb-2">反馈类型</Text>
            <View className="flex gap-2">
              <Button
                variant={feedbackType === 'bug' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeedbackType('bug')}
              >
                🐛 Bug
              </Button>
              <Button
                variant={feedbackType === 'feature' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeedbackType('feature')}
              >
                💡 建议
              </Button>
              <Button
                variant={feedbackType === 'other' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeedbackType('other')}
              >
                📝 其他
              </Button>
            </View>
          </View>

          {/* 问题描述 */}
          <View>
            <Text className="block text-sm font-medium mb-2">问题描述</Text>
            <Textarea
              placeholder="请详细描述您遇到的问题或建议..."
              value={description}
              onInput={(e) => setDescription((e.target as any).value)}
              className="min-h-[120px]"
            />
            <Text className="text-xs text-gray-500 mt-1">
              将自动包含当前对话内容（{messages.length} 条消息）
            </Text>
          </View>
        </View>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !description.trim()}>
            {submitting ? '提交中...' : '提交'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
