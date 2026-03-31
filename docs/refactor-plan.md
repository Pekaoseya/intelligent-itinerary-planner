# 前端架构重构方案

## 一、核心原则

### 1. 单一职责原则（SRP）
- 每个模块只做一件事
- 组件只负责 UI，逻辑抽到 Hooks
- API 调用抽到 Service 层

### 2. 关注点分离
- **UI 层**：只负责渲染和用户交互
- **逻辑层**：状态管理、业务逻辑
- **数据层**：API 调用、数据转换
- **工具层**：纯函数、工具方法

### 3. 依赖倒置
- 组件依赖抽象（Hooks/Store），不依赖具体实现
- 便于测试和替换

---

## 二、目录结构

```
src/
├── pages/
│   └── index/
│       ├── index.tsx              # 主页面组件（精简版，<200 行）
│       ├── index.config.ts
│       ├── index.css
│       └── components/            # 页面级组件
│           ├── MessageList.tsx    # 消息列表
│           ├── MessageItem.tsx    # 单条消息
│           ├── InputBar.tsx       # 输入栏
│           ├── LocationBar.tsx    # 定位栏
│           └── ToolResultCard.tsx # 工具结果卡片
│
├── hooks/                         # 业务 Hooks
│   ├── useChat.ts                 # AI 对话逻辑
│   ├── useLocation.ts             # 定位逻辑
│   ├── useTask.ts                 # 任务管理
│   └── useConfirmModal.ts         # 确认弹窗逻辑
│
├── stores/                        # Zustand 状态管理
│   ├── chatStore.ts               # 对话状态
│   ├── locationStore.ts           # 定位状态
│   └── confirmStore.ts            # 确认弹窗状态
│
├── services/                      # API 服务层
│   ├── chatService.ts             # AI 对话 API
│   ├── taskService.ts             # 任务 API
│   └── locationService.ts         # 定位服务
│
├── utils/                         # 工具函数
│   ├── address.ts                 # 地址处理
│   ├── date.ts                    # 日期处理
│   └── format.ts                  # 格式化工具
│
└── types/                         # 类型定义
    ├── chat.ts                    # 对话相关类型
    ├── task.ts                    # 任务相关类型
    └── location.ts                # 定位相关类型
```

---

## 三、分层职责

### 1. Store 层（状态管理）

**职责**：集中管理跨组件状态，提供读写接口

```typescript
// src/stores/chatStore.ts
import { create } from 'zustand'

interface ChatState {
  messages: Message[]
  isLoading: boolean
  
  // Actions
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  setLoading: (loading: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),
  
  setLoading: (loading) => set({ isLoading: loading })
}))
```

### 2. Service 层（API 封装）

**职责**：封装所有网络请求，提供清晰的接口

```typescript
// src/services/taskService.ts
import { Network } from '@/network'
import type { Task } from '@/types/task'

export const taskService = {
  // 获取今日任务
  getTodayTasks: async (): Promise<Task[]> => {
    const res = await Network.request({ url: '/api/tasks/today' })
    return res.data.data
  },
  
  // 创建任务
  createTask: async (task: Partial<Task>): Promise<Task> => {
    const res = await Network.request({
      url: '/api/tasks',
      method: 'POST',
      data: task
    })
    return res.data.data
  },
  
  // 批量创建
  batchCreate: async (tasks: Partial<Task>[]): Promise<Task[]> => {
    const res = await Network.request({
      url: '/api/tasks/batch',
      method: 'POST',
      data: { tasks }
    })
    return res.data.data
  }
}
```

### 3. Hook 层（业务逻辑）

**职责**：封装业务逻辑，协调 Store 和 Service

```typescript
// src/hooks/useChat.ts
import { useCallback } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { chatService } from '@/services/chatService'
import { streamingClient } from '@/streaming'

export function useChat() {
  const { messages, addMessage, updateMessage, setLoading } = useChatStore()
  
  const sendMessage = useCallback(async (content: string) => {
    // 1. 添加用户消息
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    })
    
    // 2. 创建 AI 消息占位
    const aiMessageId = Date.now().toString() + '-ai'
    addMessage({
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    })
    
    // 3. 流式请求
    setLoading(true)
    const connection = streamingClient.connect({
      url: '/api/chat/stream',
      body: { message: content },
      onChunk: (chunk) => {
        updateMessage(aiMessageId, { 
          content: prev => prev + chunk.content 
        })
      },
      onComplete: () => setLoading(false)
    })
    
    return connection
  }, [addMessage, updateMessage, setLoading])
  
  return { messages, sendMessage }
}
```

### 4. Component 层（UI 渲染）

**职责**：只负责渲染和用户交互，不包含业务逻辑

```typescript
// src/pages/index/components/MessageList.tsx
import { ScrollView } from '@tarojs/components'
import { MessageItem } from './MessageItem'
import type { Message } from '@/types/chat'

interface Props {
  messages: Message[]
  onScrollToBottom?: () => void
}

export function MessageList({ messages, onScrollToBottom }: Props) {
  return (
    <ScrollView scrollY scrollIntoView={...}>
      {messages.map(msg => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </ScrollView>
  )
}
```

---

## 四、重构步骤

### 阶段 1：类型抽离（1 天）
- [ ] 创建 `types/` 目录
- [ ] 将所有 interface 移到对应文件
- [ ] 统一导入路径

### 阶段 2：状态管理迁移（2 天）
- [ ] 安装 Zustand
- [ ] 创建 `stores/` 目录
- [ ] 将 useState 迁移到 Store
- [ ] 测试状态迁移

### 阶段 3：Service 层抽取（1 天）
- [ ] 创建 `services/` 目录
- [ ] 封装所有 API 调用
- [ ] 统一错误处理

### 阶段 4：Hook 层抽取（2 天）
- [ ] 创建 `hooks/` 目录
- [ ] 拆分业务逻辑到 Hooks
- [ ] 编写 Hook 单元测试

### 阶段 5：组件拆分（2 天）
- [ ] 创建 `components/` 目录
- [ ] 拆分 UI 组件
- [ ] 优化组件性能（memo、useMemo）

### 阶段 6：集成测试（1 天）
- [ ] 测试各模块集成
- [ ] 性能测试
- [ ] 代码审查

---

## 五、预期收益

### 代码质量
- ✅ 主页面代码量：1093 行 → < 200 行
- ✅ 单个文件不超过 300 行
- ✅ 每个模块职责清晰

### 可维护性
- ✅ 定位问题快速（按模块查找）
- ✅ 修改影响范围小
- ✅ 代码复用率高

### 可测试性
- ✅ Service 层可独立测试
- ✅ Hook 可单独测试
- ✅ UI 组件可快照测试

### 性能优化
- ✅ 状态按模块隔离，减少重渲染
- ✅ 组件可独立 memo
- ✅ 懒加载更容易实现
