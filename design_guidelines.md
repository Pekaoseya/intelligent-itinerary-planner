# 智能出行+日程记录助手 - 设计指南

## 1. 品牌定位

**应用定位**：智能出行与日程管理助手，通过 AI 对话理解用户意图，自动规划行程并推荐生活服务

**设计风格**：现代、专业、清爽、智能

**目标用户**：商务人士、旅行爱好者、时间管理者

## 2. 配色方案

### 主色板（智能科技感）

- **主色 Primary**：`#1890ff` (蓝色 - 科技、信任、智能)
  - Tailwind: `bg-blue-500`, `text-blue-500`
- **辅助色 Secondary**：`#52c41a` (绿色 - 出行、活力)
  - Tailwind: `bg-green-500`, `text-green-500`
- **强调色 Accent**：`#faad14` (橙色 - 提醒、推荐)
  - Tailwind: `bg-amber-500`, `text-amber-500`

### 中性色

- **文字主色**：`#1f2937` (gray-800)
- **文字次色**：`#6b7280` (gray-500)
- **文字辅助**：`#9ca3af` (gray-400)
- **背景色**：`#f9fafb` (gray-50)
- **分割线**：`#e5e7eb` (gray-200)

### 语义色

- **成功**：`#10b981` (green-500)
- **警告**：`#f59e0b` (amber-500)
- **错误**：`#ef4444` (red-500)
- **信息**：`#3b82f6` (blue-500)

## 3. 字体规范

### 标题层级

- **H1 页面标题**：`text-2xl font-bold` (24px)
- **H2 区块标题**：`text-xl font-semibold` (20px)
- **H3 卡片标题**：`text-lg font-medium` (18px)
- **H4 列表标题**：`text-base font-medium` (16px)

### 正文与说明

- **正文**：`text-sm` (14px)
- **说明文字**：`text-xs text-gray-500` (12px)
- **标签**：`text-xs font-medium` (12px)

## 4. 间距系统

### 页面布局

- **页面边距**：`p-4` (16px)
- **页面底部安全区**：`pb-20` (80px - 避开底部导航)

### 组件间距

- **卡片间距**：`gap-4` (16px)
- **列表项间距**：`gap-3` (12px)
- **按钮组间距**：`gap-2` (8px)

### 卡片内边距

- **标准卡片**：`p-4` (16px)
- **紧凑卡片**：`p-3` (12px)
- **宽松卡片**：`p-6` (24px)

## 5. 组件规范

### 按钮样式

**主按钮**：
```tsx
import { Button } from '@/components/ui/button'
<Button className="bg-blue-500 hover:bg-blue-600 text-white">确认</Button>
```

**次按钮**：
```tsx
<Button variant="outline" className="border-gray-300">取消</Button>
```

**图标按钮**：
```tsx
<Button size="icon" className="rounded-full">
  <Plus size={20} />
</Button>
```

### 卡片容器

**标准卡片**：
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
<Card className="rounded-xl shadow-sm">
  <CardHeader>
    <CardTitle className="text-lg">日程安排</CardTitle>
  </CardHeader>
  <CardContent>
    {/* 内容 */}
  </CardContent>
</Card>
```

### 输入框

**聊天输入框**：
```tsx
import { Input } from '@/components/ui/input'
<View className="bg-gray-50 rounded-2xl px-4 py-3 flex-1">
  <Input className="bg-transparent w-full" placeholder="说点什么..." />
</View>
```

### 时间轴/节点

**出行节点**：
```tsx
<View className="flex flex-col gap-3">
  <View className="flex items-start gap-3">
    <View className="w-3 h-3 rounded-full bg-blue-500 mt-1.5" />
    <View className="flex-1">
      <Text className="block font-medium">北京首都机场</Text>
      <Text className="block text-xs text-gray-500">08:30 出发</Text>
    </View>
  </View>
  <View className="ml-1.5 w-0.5 h-6 bg-gray-200" />
  {/* 下一个节点 */}
</View>
```

### 空状态

```tsx
<View className="flex flex-col items-center justify-center py-12">
  <Calendar className="text-gray-300 mb-3" size={48} />
  <Text className="block text-gray-500 mb-2">暂无日程</Text>
  <Text className="block text-xs text-gray-400">点击下方按钮创建新日程</Text>
</View>
```

## 6. 导航结构

### TabBar 配置

- **首页**：对话界面（AI 助手）
- **日程**：日程管理列表
- **出行**：出行规划展示
- **我的**：个人中心

### 页面跳转

- TabBar 页面：使用 `Taro.switchTab()`
- 普通页面：使用 `Taro.navigateTo()`
- 返回：使用 `Taro.navigateBack()`

## 7. 图标规范

使用 `lucide-react-taro` 图标库：

- **导航图标**：`MessageSquare`, `Calendar`, `Map`, `User`
- **功能图标**：`Plus`, `Edit`, `Trash2`, `Check`
- **出行图标**：`Plane`, `Train`, `Car`, `Hotel`, `Utensils`
- **状态图标**：`Clock`, `AlertCircle`, `CheckCircle`

## 8. 特殊场景样式

### 对话气泡

**用户消息**：
```tsx
<View className="flex justify-end mb-3">
  <View className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[70%]">
    <Text className="text-sm">帮我规划明天去上海的行程</Text>
  </View>
</View>
```

**AI 回复**：
```tsx
<View className="flex justify-start mb-3">
  <View className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[70%]">
    <Text className="text-sm">好的，我已为您规划好行程...</Text>
  </View>
</View>
```

### 推荐卡片

```tsx
<Card className="rounded-xl overflow-hidden">
  <Image src={imageUrl} className="w-full h-32 object-cover" />
  <CardContent className="p-3">
    <Text className="block font-medium text-sm mb-1">推荐餐厅</Text>
    <Text className="block text-xs text-gray-500">距您 500m · 粤菜 · ¥88/人</Text>
  </CardContent>
</Card>
```

## 9. 小程序约束

### 性能优化

- 图片使用 `lazyLoad` 属性
- 长列表使用虚拟列表
- 避免频繁 `setData`

### 包体积

- 主包体积 ≤ 2MB
- 总包体积 ≤ 20MB
- 图标使用图标库而非图片

### 权限配置

```typescript
// app.config.ts
permission: {
  'scope.userLocation': {
    desc: '用于规划出行路线'
  }
}
```
