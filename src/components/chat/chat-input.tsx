/**
 * 聊天输入组件
 */

import { View, Input, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Send } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'

export interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  loading?: boolean
  onCancel?: () => void
}

export const ChatInput: FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  loading,
  onCancel,
}) => {
  return (
    <View
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderTop: '1px solid #e5e7eb',
        zIndex: 100
      }}
    >
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: '20px', padding: '8px 12px' }}>
        <Input
          style={{ width: '100%', fontSize: '14px' }}
          placeholder="告诉我您想做什么..."
          value={value}
          onInput={(e) => onChange(e.detail.value)}
          onConfirm={onSend}
          confirmType="send"
        />
      </View>
      <View style={{ flexShrink: 0 }}>
        {loading ? (
          <Button size="default" className="rounded-full px-4" onClick={onCancel}>
            <Text className="text-sm text-white">取消</Text>
          </Button>
        ) : (
          <Button size="default" className="rounded-full px-4" onClick={onSend} disabled={!value.trim()}>
            <Send size={18} color={value.trim() ? '#fff' : '#999'} />
          </Button>
        )}
      </View>
    </View>
  )
}

export default ChatInput
