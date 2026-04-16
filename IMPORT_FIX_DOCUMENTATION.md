# 导入错误修复说明

修复日期：2026-04-15
修复文件：server/src/modules/task/task.repository.ts

---

## 问题描述

### 错误信息
```
Cannot find module '../../services/supabase.service'
```

### 问题原因
`task.repository.ts` 文件中错误地导入了一个不存在的服务类：
```typescript
import { SupabaseService } from '../../services/supabase.service'  // ❌ 错误
```

这个路径和类名都不存在，导致下载到本地后无法运行。

---

## 实际情况

### 正确的文件
- **文件路径：** `server/src/storage/database/supabase-client.ts`
- **导出内容：** `getSupabaseClient` 函数

### 正确的导入方式
其他模块都是这样导入的：
```typescript
import { getSupabaseClient } from '../../storage/database/supabase-client'  // ✅ 正确
```

---

## 修复内容

### 修复前
```typescript
import { Injectable, Logger } from '@nestjs/common'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseService } from '../../services/supabase.service'  // ❌ 错误
import type { Task, TaskType, TaskStatus } from '../../common/types'

@Injectable()
export class TaskRepository {
  private readonly logger = new Logger(TaskRepository.name)
  private supabase: SupabaseClient

  constructor(private readonly supabaseService: SupabaseService) {  // ❌ 错误
    this.supabase = this.supabaseService.getClient()
  }
  // ...
}
```

### 修复后
```typescript
import { Injectable, Logger } from '@nestjs/common'
import { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../storage/database/supabase-client'  // ✅ 正确
import type { Task, TaskType, TaskStatus } from '../../common/types'

@Injectable()
export class TaskRepository {
  private readonly logger = new Logger(TaskRepository.name)
  private supabase: SupabaseClient

  constructor() {  // ✅ 正确
    this.supabase = getSupabaseClient()
  }
  // ...
}
```

---

## task.repository.ts 是干嘛的？

这是一个**数据仓储层（Repository）**文件，负责：

### 1. 数据库交互
- **增：** 创建任务（create）
- **删：** 删除任务（delete, deleteMany）
- **改：** 更新任务（update）
- **查：** 查询任务（findAll, findById, search）

### 2. 类型转换
```typescript
// DECIMAL string → number
function transformTaskData(task: any): Task {
  return {
    ...task,
    latitude: parseFloat(String(task.latitude)),    // string → number
    longitude: parseFloat(String(task.longitude)),  // string → number
    // ...
  }
}
```

### 3. 业务逻辑
- **时间冲突检测：** findConflicts()
- **任务统计：** count()
- **任务事件记录：** logEvent()
- **任务状态管理：** markCompleted()

### 4. 数据过滤
```typescript
async findAll(userId: string, filters?: {
  status?: TaskStatus
  type?: TaskType
  date?: string
  startDate?: string
  endDate?: string
}): Promise<Task[]>
```

---

## 架构模式

### Repository 模式

```
Controller (控制器层)
    ↓
Service (业务逻辑层)
    ↓
Repository (数据访问层)  ← task.repository.ts
    ↓
Database (数据库)
```

### 优势

1. **解耦：** 分离业务逻辑和数据访问
2. **复用：** 多个 Service 可以复用同一个 Repository
3. **测试：** 可以 mock Repository 进行单元测试
4. **维护：** 数据访问逻辑集中管理

---

## 相关文件

### 数据库配置
- `server/src/storage/database/supabase-client.ts` - Supabase 客户端
- `server/src/storage/database/shared/schema.ts` - 数据库 Schema 定义

### 类型定义
- `server/src/common/types/task.types.ts` - Task 类型定义

### 业务层
- `server/src/modules/task/task.service.ts` - 任务业务逻辑
- `server/src/modules/task/task.controller.ts` - 任务 API 控制器

---

## 验证结果

### 编译检查
```bash
pnpm validate
```

结果：
- ✅ ESLint: 通过
- ✅ TypeScript: 通过

### 运行测试
```bash
# 启动后端服务
cd server && pnpm run start

# 调用 API
curl http://localhost:3000/api/tasks
```

结果：
- ✅ 服务正常启动
- ✅ API 正常响应

---

## 影响范围

### 受影响的模块
- ✅ TaskService（任务业务逻辑）
- ✅ TaskController（任务 API）
- ✅ AI 工具（taxi.tool.ts, train.tool.ts 等）

### 不受影响的模块
- ✅ LocationService（使用不同的导入方式）
- ✅ RecommendationService（使用不同的导入方式）

---

## 预防措施

### 1. 统一导入规范
```typescript
// ✅ 推荐方式
import { getSupabaseClient } from '../../storage/database/supabase-client'

// ❌ 禁止方式
import { SupabaseService } from '../../services/supabase.service'
```

### 2. 代码审查清单
- [ ] 检查导入路径是否正确
- [ ] 检查导入的类/函数是否存在
- [ ] 遵循项目现有的导入规范

### 3. 自动化检查
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## 总结

### 问题
- ❌ 导入不存在的 SupabaseService
- ❌ 路径错误
- ❌ 依赖注入方式错误

### 解决
- ✅ 使用正确的 getSupabaseClient 函数
- ✅ 使用正确的路径
- ✅ 移除依赖注入，直接调用函数

### 结果
- ✅ 代码可以正常编译
- ✅ 代码可以正常运行
- ✅ 与其他模块保持一致

---

**修复完成日期：** 2026-04-15
**修复提交：** 5f6da09
**状态：** ✅ 已修复并推送到远端
