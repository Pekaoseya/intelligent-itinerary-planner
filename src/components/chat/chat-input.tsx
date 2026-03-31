/**
 * 聊天输入组件
 */

import { View, Input } from '@tarojs/components'
import type { FC } from 'react'
import { Send, Locate, Loader } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import type { UserLocation } from '@/types'

export interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onGetLocation?: () => void
  location?: UserLocation | null
  locationLoading?: boolean
  loading?: boolean
}

export const ChatInput: FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onGetLocation,
  location,
  locationLoading,
  loading,
}) => {
  return (
    <View
      className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: '60px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* 定位按钮 */}
      {onGetLocation && (
        <View
          className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          onClick={onGetLocation}
        >
          {locationLoading ? (
            <Loader size={18} color="#999" />
          ) : (
            <Locate size={18} color={location ? '#1890ff' : '#999'} />
          )}
        </View>
      )}

      {/* 输入框 */}
      <View
        className="flex-1 bg-gray-100 rounded-full"
        style={{ minHeight: '36px', display: 'flex', alignItems: 'center', paddingLeft: '16px', paddingRight: '16px' }}
      >
        <Input
          className="w-full bg-transparent text-sm"
          placeholder="输入消息..."
          value={value}
          onInput={(e) => onChange(e.detail.value)}
          onConfirm={onSend}
          confirmType="send"
        />
      </View>

      {/* 发送按钮 */}
      <Button
        size="sm"
        className="rounded-full w-10 h-10 p-0"
        disabled={!value.trim() || loading}
        onClick={onSend}
      >
        {loading ? (
          <Loader size={18} color="#fff" />
        ) : (
          <Send size={18} color="#fff" />
        )}
      </Button>
    </View>
  )
}

export default ChatInput
