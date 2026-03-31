# 重构前后对比

## 代码量对比

| 模块 | 重构前 | 重构后 |
|-----|-------|-------|
| **index.tsx** | 1093 行 | ~150 行 |
| 状态管理 | 混在组件中 | 独立 Store (~50 行/个) |
| 业务逻辑 | 混在组件中 | 独立 Hook (~100 行/个) |
| API 调用 | 散落各处 | 独立 Service (~50 行/个) |
| UI 组件 | 1 个大组件 | 多个小组件 (<100 行/个) |

---

## 职责划分对比

### 重构前（❌ 混乱）

```
index.tsx (1093 行)
├── 类型定义 (80 行)
├── 20+ useState 状态声明 (50 行)
├── 工具函数 (100 行)
├── API 调用逻辑 (200 行)
├── 流式处理逻辑 (150 行)
├── 确认弹窗逻辑 (100 行)
├── 定位逻辑 (50 行)
└── UI 渲染 (300+ 行)
```

### 重构后（✅ 清晰）

```
页面层
├── index.tsx (~150 行) - 页面布局、组件组合

组件层
├── LocationBar.tsx (~50 行) - 定位栏 UI
├── MessageList.tsx (~80 行) - 消息列表 UI
├── MessageItem.tsx (~100 行) - 单条消息 UI
├── InputBar.tsx (~60 行) - 输入栏 UI
└── LocationDetailModal.tsx (~40 行) - 详情弹窗

Hooks 层
├── useChat.ts (~100 行) - AI 对话逻辑
├── useLocation.ts (~50 行) - 定位逻辑
├── useTask.ts (~80 行) - 任务管理逻辑
└── useConfirmModal.ts (~60 行) - 确认弹窗逻辑

Store 层
├── chatStore.ts (~50 行) - 对话状态
├── locationStore.ts (~30 行) - 定位状态
└── confirmStore.ts (~40 行) - 确认弹窗状态

Service 层
├── chatService.ts (~50 行) - AI 对话 API
├── taskService.ts (~60 行) - 任务 API
└── locationService.ts (~20 行) - 定位服务

类型层
├── chat.ts (~40 行) - 对话类型
├── task.ts (~30 行) - 任务类型
└── location.ts (~15 行) - 定位类型
```

---

## 关键改进点

### 1. 状态管理

**问题**：20+ useState 挤在一个组件

```typescript
// ❌ 重构前
const [messages, setMessages] = useState([])
const [inputText, setInputText] = useState('')
const [isLoading, setIsLoading] = useState(false)
const [scrollCounter, setScrollCounter] = useState(0)
const [userLocation, setUserLocation] = useState(null)
const [locationLoading, setLocationLoading] = useState(true)
const [locationError, setLocationError] = useState(null)
const [showLocationDetail, setShowLocationDetail] = useState(false)
const [confirmType, setConfirmType] = useState('batch_add')
const [showConfirmModal, setShowConfirmModal] = useState(false)
// ... 还有 10+ 个
```

```typescript
// ✅ 重构后
// 按职责拆分到独立 Store
const chat = useChatStore()        // 对话相关
const location = useLocationStore() // 定位相关
const confirm = useConfirmStore()   // 确认弹窗相关
```

### 2. 业务逻辑

**问题**：逻辑和 UI 耦合，无法复用、无法测试

```typescript
// ❌ 重构前：逻辑写在组件里
const sendMessage = async () => {
  // 100+ 行逻辑...
  const res = await Network.request(...)
  // 状态更新...
  setMessages(...)
  setIsLoading(...)
}
```

```typescript
// ✅ 重构后：逻辑抽到 Hook
// hooks/useChat.ts
export function useChat() {
  const { addMessage, setLoading } = useChatStore()
  
  const sendMessage = async (content: string) => {
    // 清晰的业务逻辑
  }
  
  return { sendMessage }
}

// 组件中只调用
const { sendMessage } = useChat()
```

### 3. API 调用

**问题**：散落在各处，没有统一错误处理

```typescript
// ❌ 重构前：到处都是 API 调用
const res1 = await Network.request({ url: '/api/tasks/today' })
const res2 = await Network.request({ url: '/api/tasks', method: 'POST' })
const res3 = await Network.request({ url: '/api/tasks/batch' })
```

```typescript
// ✅ 重构后：统一封装
// services/taskService.ts
export const taskService = {
  getTodayTasks: async () => { /* ... */ },
  createTask: async (task) => { /* ... */ },
  batchCreate: async (tasks) => { /* ... */ },
}

// 使用
const tasks = await taskService.getTodayTasks()
```

### 4. UI 组件

**问题**：所有 JSX 挤在一个 return 里

```typescript
// ❌ 重构前：300+ 行 JSX
return (
  <View>
    {/* 定位栏 - 50 行 */}
    {/* 消息列表 - 100 行 */}
    {/* 输入栏 - 50 行 */}
    {/* 确认弹窗 - 80 行 */}
    {/* 定位详情弹窗 - 40 行 */}
  </View>
)
```

```typescript
// ✅ 重构后：组件拆分
return (
  <View>
    <LocationBar {...locationProps} />
    <MessageList {...messageProps} />
    <InputBar {...inputProps} />
    <LocationDetailModal {...modalProps} />
  </View>
)
```

---

## 测试性改进

### 重构前：难以测试

```typescript
// ❌ 无法单独测试业务逻辑
// 必须渲染整个组件才能测试
import { render } from '@testing-library/react'
import Index from './index'

test('send message', async () => {
  const { getByText } = render(<Index />)
  // 测试复杂，需要 mock 很多依赖
})
```

### 重构后：易于测试

```typescript
// ✅ Hook 可单独测试
import { renderHook } from '@testing-library/react-hooks'
import { useChat } from '@/hooks/useChat'

test('useChat sendMessage', async () => {
  const { result } = renderHook(() => useChat())
  
  await act(async () => {
    await result.current.sendMessage('test')
  })
  
  expect(result.current.messages.length).toBe(1)
})

// ✅ Service 可单独测试
import { taskService } from '@/services/taskService'

test('createTask', async () => {
  const task = await taskService.createTask({ title: 'test' })
  expect(task.id).toBeDefined()
})

// ✅ Store 可单独测试
import { useChatStore } from '@/stores/chatStore'

test('addMessage', () => {
  const { addMessage, messages } = useChatStore.getState()
  addMessage({ id: '1', role: 'user', content: 'test' })
  expect(useChatStore.getState().messages.length).toBe(1)
})
```

---

## 性能改进

### 重构前：性能隐患

```typescript
// ❌ 任何状态变化都会重渲染整个组件
const [loading, setLoading] = useState(false) // 变化 → 整个组件重渲染
const [inputText, setInputText] = useState('') // 变化 → 整个组件重渲染
// ... 20+ 个状态，频繁重渲染
```

### 重构后：性能优化

```typescript
// ✅ 状态隔离，只重渲染使用该状态的组件
// LocationBar 只订阅 location 相关状态
const location = useLocationStore() 

// MessageList 只订阅 messages 状态
const messages = useChatStore(state => state.messages)

// InputBar 只订阅 inputText 状态
const inputText = useChatStore(state => state.inputText)
```

---

## 维护性改进

### 重构前：难以定位问题

```
问题：消息发送失败
定位流程：
1. 打开 index.tsx (1093 行)
2. 找到 sendMessage 函数（混在 20+ 个函数中）
3. 查看 API 调用逻辑（混在组件中）
4. 检查状态更新逻辑（混在函数中）
⏱️ 预计耗时：30+ 分钟
```

### 重构后：快速定位问题

```
问题：消息发送失败
定位流程：
1. 打开 hooks/useChat.ts (100 行)
2. 查看 sendMessage 函数
3. 如需看 API → 打开 services/chatService.ts
4. 如需看状态 → 打开 stores/chatStore.ts
⏱️ 预计耗时：5 分钟
```

---

## 总结

| 维度 | 重构前 | 重构后 |
|-----|-------|-------|
| **代码量** | 1093 行/文件 | < 150 行/文件 |
| **可读性** | ❌ 混乱 | ✅ 清晰 |
| **可维护性** | ❌ 难以维护 | ✅ 易于维护 |
| **可测试性** | ❌ 难以测试 | ✅ 易于测试 |
| **性能** | ❌ 频繁重渲染 | ✅ 状态隔离 |
| **复用性** | ❌ 无法复用 | ✅ 高度复用 |

**核心原则**：
1. 单一职责：一个模块只做一件事
2. 关注点分离：UI / 逻辑 / 数据 分离
3. 依赖倒置：依赖抽象，不依赖具体实现
