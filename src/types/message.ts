/**
 * 消息相关类型定义
 */

// 工具执行结果
export interface ToolResult {
  tool: string
  args: unknown
  result: {
    success: boolean
    data?: unknown
    message?: string
    error?: string
  }
}

// 消息
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string[]
  tool_results?: ToolResult[]
  data?: unknown
  timestamp: Date
}
