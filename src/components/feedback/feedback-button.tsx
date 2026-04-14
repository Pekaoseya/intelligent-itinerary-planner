/**
 * 反馈按钮组件
 */

import { Bug } from 'lucide-react-taro'
import { View } from '@tarojs/components'
import { Button } from '@/components/ui/button'

interface FeedbackButtonProps {
  onClick: () => void
}

export function FeedbackButton({ onClick }: FeedbackButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="gap-2 text-gray-600"
    >
      <Bug size={16} />
      <View>反馈</View>
    </Button>
  )
}
