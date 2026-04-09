# 项目架构图集

本文档包含项目的核心架构图，方便快速浏览。

## 📊 快速导航

- [模块架构](#1-模块架构)
- [数据库关系](#2-数据库关系)
- [核心流程](#3-核心流程)
- [时序图](#4-时序图)
- [部署架构](#5-部署架构)

---

## 1. 模块架构

### 模块依赖关系

```mermaid
graph TD
    A[Agent Module AI 核心模块] --> B[UserContext Module 用户上下文]
    A --> C[Task Module 任务管理]
    A --> D[Location Module 位置服务]
    A --> E[Map Module 地图服务]

    A --> F[Recommendation Module 推荐服务]
    A --> G[Stats Module 统计服务]

    C --> H[Supabase 数据库]
    F --> H
    G --> H
    B --> H

    D --> I[高德地图 API]
    E --> I

    style A fill:#4CAF50
    style H fill:#2196F3
    style I fill:#FF9800
```

**模块说明**

| 模块 | 职责 | 核心组件 |
|------|------|----------|
| Agent | AI 对话核心 | AgentService, AgentController, ConflictOptimizer |
| Task | 任务管理 | TaskService, TaskRepository, TaskScheduler |
| UserContext | 用户画像 | UserContextService |
| Location | 位置服务 | LocationService |
| Map | 地图服务 | MapService |
| Recommendation | 推荐服务 | RecommendationService |
| Stats | 统计服务 | StatsService |

---

## 2. 数据库关系

### 数据库表关系图

```mermaid
erDiagram
    %% 用户相关
    USER ||--o{ CONVERSATION : creates
    USER ||--o{ MESSAGE : sends
    USER ||--o{ TASK : owns
    USER ||--o{ TASK_EVENT : generates
    USER ||--o{ TOOL_CALL : initiates
    USER ||--o{ RECOMMENDATION : receives

    %% 对话与消息
    CONVERSATION ||--o{ MESSAGE : contains

    %% 任务与事件
    TASK ||--o{ TASK_EVENT : logs

    %% 关键字段
    CONVERSATION {
        varchar id PK
        varchar user_id FK
        varchar title
        timestamp created_at
        timestamp updated_at
    }

    MESSAGE {
        varchar id PK
        varchar conversation_id FK
        varchar user_id FK
        varchar role
        text content
        text reasoning
        jsonb tool_calls
        timestamp created_at
    }

    TASK {
        varchar id PK
        varchar user_id FK
        varchar title
        varchar type
        varchar status
        timestamp scheduled_time
        timestamp end_time
        varchar location_name
        varchar destination_name
        jsonb metadata
        boolean is_expired
        timestamp created_at
        timestamp updated_at
        timestamp completed_at
    }

    TASK_EVENT {
        varchar id PK
        varchar task_id FK
        varchar user_id FK
        varchar event_type
        jsonb changes
        varchar tool_name
        text reasoning
        timestamp created_at
    }

    TOOL_CALL {
        varchar id PK
        varchar user_id FK
        varchar conversation_id FK
        varchar tool_name
        jsonb tool_args
        jsonb tool_result
        varchar status
        text error_message
        timestamp created_at
        timestamp executed_at
    }

    LOCATION_CACHE {
        varchar id PK
        varchar name UK
        text address
        varchar latitude
        varchar longitude
        varchar city
        varchar province
        text polyline
        timestamp created_at
        timestamp updated_at
    }

    RECOMMENDATION {
        varchar id PK
        varchar user_id FK
        varchar type
        varchar title
        text description
        varchar rating
        varchar distance
        varchar price
        text[] tags
        varchar location_name
        text location_address
        text latitude
        text longitude
        boolean is_favorite
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
```

**核心表说明**

| 表名 | 用途 | 记录数 | 索引 |
|------|------|--------|------|
| tasks | 任务数据 | ~1000/用户 | 5 个索引 |
| conversations | 对话记录 | ~10/用户 | 1 个索引 |
| messages | 消息记录 | ~1000/用户 | 2 个索引 |
| task_events | 任务操作日志 | ~2000/用户 | 2 个索引 |
| tool_calls | 工具调用日志 | ~5000/用户 | 3 个索引 |
| location_cache | 位置缓存 | ~1000 | 3 个索引 |
| recommendations | 推荐数据 | ~100/用户 | 3 个索引 |

---

## 3. 核心流程

### 3.1 AI 对话核心流程

```mermaid
flowchart TD
    Start[用户发送消息] --> LoadHistory[加载历史对话 最近 10 条]
    LoadHistory --> LoadContext[获取用户上下文 用户画像+统计数据]
    LoadContext --> BuildPrompt[构建系统提示词 时间+位置+用户画像]
    BuildPrompt --> CallLLM[调用大语言模型 流式响应]

    CallLLM --> ParseResponse{解析 AI 响应}
    ParseResponse --> HasToolCalls{有工具调用?}

    HasToolCalls -->|是| ValidateParams[参数校验]
    HasToolCalls -->|否| DirectReply[直接返回回复]

    ValidateParams --> ValidationOK{校验通过?}
    ValidationOK -->|是| ExecuteTool[执行工具]
    ValidationOK -->|否| SmartRetry[智能重试 传递完整历史消息]

    ExecuteTool --> ToolSuccess{执行成功?}
    ToolSuccess -->|是| GenerateReply[生成友好回复]
    ToolSuccess -->|否| RecordError[记录错误日志]

    SmartRetry --> CallLLM
    RecordError --> ReturnError[返回错误信息]

    GenerateReply --> SaveMessage[保存消息到数据库]
    DirectReply --> SaveMessage
    SaveMessage --> SSEPush[SSE 推送给前端]
    SSEPush --> End[完成]

    style Start fill:#4CAF50
    style End fill:#4CAF50
    style CallLLM fill:#2196F3
    style ExecuteTool fill:#FF9800
```

### 3.2 任务创建流程（含确认机制）

```mermaid
flowchart TD
    Start["用户: '明天下午2点开会'] --> AIUnderstand[AI 理解意图]
    AIUnderstand --> CheckMissing{信息完整?}

    CheckMissing -->|否| AskUser[询问用户]
    CheckMissing -->|是| CallTool[调用 task_create confirm=false]

    AskUser --> UserReply[用户回复]
    UserReply --> AIUnderstand

    CallTool --> SaveTask[保存任务 status=pending]
    SaveTask --> SaveEvent[记录任务事件]
    SaveEvent --> ReturnPreview[返回预览信息]

    ReturnPreview --> FrontendDisplay[前端显示确认弹窗]
    FrontendDisplay --> UserConfirm{用户确认?}

    UserConfirm -->|确定| CallConfirm[调用 task_create confirm=true]
    UserConfirm -->|取消| DeletePending[删除 pending 任务]

    CallConfirm --> UpdateStatus[更新 status=confirmed]
    UpdateStatus --> SaveConfirmEvent[记录确认事件]
    SaveConfirmEvent --> CheckConflict[检查时间冲突]

    CheckConflict --> HasConflict{有冲突?}
    HasConflict -->|是| CallOptimizer[调用冲突优化]
    HasConflict -->|否| Complete[完成创建]

    CallOptimizer --> ShowOptions[显示优化方案]
    ShowOptions --> UserSelectOpt[用户选择优化方案]
    UserSelectOpt --> ApplySolution[应用优化方案]
    ApplySolution --> Complete

    DeletePending --> Cancel[取消创建]
    Complete --> End[任务创建成功]
    Cancel --> End

    style Start fill:#4CAF50
    style End fill:#4CAF50
    style CallTool fill:#FF9800
    style CallConfirm fill:#2196F3
    style CallOptimizer fill:#9C27B0
```

### 3.3 行程规划流程

```mermaid
flowchart TD
    Start["用户: '下周去上海出差'] --> AIAnalyze[AI 分析需求]
    AIAnalyze --> CheckHistory[查询历史行程]
    CheckHistory --> GetLocation[获取当前位置]

    GetLocation --> CallAmap[调用高德 API 规划路线]
    CallAmap --> ParseRoutes[解析路线方案]

    ParseRoutes --> SplitTrips[拆分为多段行程]
    SplitTrips --> GenerateTasks[生成任务预览]

    GenerateTasks --> CheckConflicts[检查时间冲突]
    CheckConflicts --> HasConflict{有冲突?}

    HasConflict -->|是| Optimize[生成优化方案]
    HasConflict -->|否| ShowRoutes[展示路线方案]

    Optimize --> ShowRoutes
    ShowRoutes --> UserSelectRoute{用户选择?}

    UserSelectRoute -->|选择路线| CreateTasks[批量创建任务]
    UserSelectRoute -->|自定义| CustomRoute[自定义路线]

    CustomRoute --> CallAmap
    CreateTasks --> SaveTasks[保存到数据库]
    SaveTasks --> End[行程规划完成]

    style Start fill:#4CAF50
    style End fill:#4CAF50
    style CallAmap fill:#FF9800
    style CreateTasks fill:#2196F3
```

### 3.4 智能重试流程

```mermaid
flowchart TD
    Start[工具调用失败] --> CheckRetryHint{有 retryHint?}
    CheckRetryHint -->|否| ReturnError[返回错误信息]
    CheckRetryHint -->|是| BuildRetryPrompt[构建重试提示]

    BuildRetryPrompt --> IncludeHistory[包含完整历史消息]
    IncludeHistory --> ShowError[展示错误信息]
    ShowError --> ShowParams[展示错误参数]
    ShowParams --> ShowCorrect[展示正确参数格式]

    ShowCorrect --> CallLLM[重新调用 LLM temperature=0.1]
    CallLLM --> ParseRetry{解析重试响应}

    ParseRetry --> HasNewCall{有新工具调用?}
    HasNewCall -->|否| ReturnError
    HasNewCall -->|是| ValidateRetry[验证新参数]

    ValidateRetry --> RetryOK{参数正确?}
    RetryOK -->|否| ReturnError
    RetryOK -->|是| ReExecuteTool[重新执行工具]

    ReExecuteTool --> Success{成功?}
    Success -->|是| UpdateResult[更新工具结果]
    Success -->|否| ReturnError

    UpdateResult --> End[重试成功]
    ReturnError --> End

    style Start fill:#F44336
    style End fill:#4CAF50
    style CallLLM fill:#2196F3
    style ReExecuteTool fill:#FF9800
```

### 3.5 用户画像生成流程

```mermaid
flowchart TD
    Start[用户操作] --> CollectData[收集行为数据]
    CollectData --> AnalyzeStats[统计分析]

    AnalyzeStats --> TaskStats[任务统计 类型/时间/地点]
    AnalyzeStats --> LocationStats[位置统计 常去地点]
    AnalyzeStats --> TimeStats[时间统计 活跃时段]
    AnalyzeStats --> PreferenceStats[偏好统计 出行方式]

    TaskStats --> GenerateTags[生成标签]
    LocationStats --> GenerateTags
    TimeStats --> GenerateTags
    PreferenceStats --> GenerateTags

    GenerateTags --> BuildProfile[构建用户画像]
    BuildProfile --> SaveProfile[保存到推荐表]
    SaveProfile --> ProvideRAG[提供 RAG 上下文]

    ProvideRAG --> AIPrompt[注入 AI 提示词]
    AIPrompt --> End[个性化响应]

    style Start fill:#4CAF50
    style End fill:#4CAF50
    style GenerateTags fill:#FF9800
    style BuildProfile fill:#2196F3
    style ProvideRAG fill:#9C27B0
```

---

## 4. 时序图

### 4.1 用户对话完整时序

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as 前端 (小程序)
    participant Agent as AgentController
    participant AgentSvc as AgentService
    participant LLM as 大语言模型
    participant Tool as ToolExecutor
    participant TaskSvc as TaskService
    participant DB as Supabase 数据库
    participant UserCtx as UserContextService

    User->>Frontend: 发送消息："明天下午2点开会"
    Frontend->>Agent: POST /api/agent/chat

    Agent->>AgentSvc: chatStream(userId, message)
    AgentSvc->>DB: 加载历史对话（最近10条）
    AgentSvc->>UserCtx: 获取用户上下文
    UserCtx->>DB: 查询用户统计数据
    DB-->>UserCtx: 返回统计数据
    UserCtx-->>AgentSvc: 返回用户画像

    AgentSvc->>AgentSvc: 构建系统提示词
    AgentSvc->>LLM: stream(messages, temperature=0.3)

    loop AI 流式响应
        LLM-->>AgentSvc: chunk.content
        AgentSvc-->>Agent: 推送进度 (SSE)
    end

    AgentSvc->>AgentSvc: 解析 AI 响应
    AgentSvc->>Tool: executeTool("task_create", args)

    Tool->>Tool: 参数校验
    Tool->>TaskSvc: createTask(args, confirm=false)
    TaskSvc->>DB: 插入任务 (status=pending)
    DB-->>TaskSvc: 返回任务 ID
    TaskSvc-->>Tool: 返回预览结果
    Tool-->>AgentSvc: 返回工具结果

    AgentSvc->>DB: 保存消息（含 tool_calls）
    AgentSvc->>LLM: stream(生成友好回复)
    LLM-->>AgentSvc: 友好文本
    AgentSvc-->>Agent: 推送完成事件
    Agent-->>Frontend: 返回完整响应

    Frontend->>Frontend: 显示确认弹窗

    User->>Frontend: 点击"确定"
    Frontend->>Agent: POST /api/agent/chat (message: "确定")

    Agent->>AgentSvc: chatStream(userId, "确定")
    AgentSvc->>DB: 加载历史对话
    AgentSvc->>LLM: stream(messages)
    LLM-->>AgentSvc: 识别为确认操作
    AgentSvc->>Tool: executeTool("task_create", args + confirm=true)

    Tool->>TaskSvc: createTask(args, confirm=true)
    TaskSvc->>DB: 更新 status=confirmed
    DB-->>TaskSvc: 成功
    TaskSvc-->>Tool: 返回成功结果
    Tool-->>AgentSvc: 返回工具结果

    AgentSvc->>DB: 保存消息
    AgentSvc->>LLM: stream(生成回复)
    LLM-->>AgentSvc: "任务已创建"
    AgentSvc-->>Agent: 返回响应
    Agent-->>Frontend: 返回成功消息
    Frontend->>Frontend: 显示成功提示
```

### 4.2 行程规划时序

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as 前端
    participant Agent as AgentController
    participant LLM as 大语言模型
    participant TripPlanner as TripPlannerService
    participant MapSvc as MapService
    participant Amap as 高德 API
    participant TaskSvc as TaskService
    participant DB as 数据库

    User->>Frontend: "下周去上海出差"
    Frontend->>Agent: POST /api/agent/chat

    Agent->>LLM: stream(分析用户意图)
    LLM-->>Agent: 识别为出行需求
    Agent->>TripPlanner: planTrip(origin, destination, date)

    TripPlanner->>DB: 查询历史出行记录
    TripPlanner->>MapSvc: 获取当前位置
    MapSvc-->>TripPlanner: 返回经纬度

    TripPlanner->>TripPlanner: 分析需求（高铁/飞机）
    TripPlanner->>Amap: GET /direction/driving (打车路线)
    TripPlanner->>Amap: GET /direction/transit (公交+地铁)
    Amap-->>TripPlanner: 返回路线方案

    TripPlanner->>TripPlanner: 拆分为多段行程
    TripPlanner->>TaskSvc: createTask (打车去机场)
    TripPlanner->>TaskSvc: createTask (飞机)
    TripPlanner->>TaskSvc: createTask (打车到酒店)

    TaskSvc->>DB: 保存任务预览
    TaskSvc-->>TripPlanner: 返回任务列表
    TripPlanner-->>Agent: 返回行程规划结果

    Agent->>LLM: stream(生成友好回复)
    LLM-->>Agent: "为您规划了3段行程..."
    Agent-->>Frontend: 返回规划结果

    Frontend->>Frontend: 显示路线方案
    Frontend->>Frontend: 检查时间冲突
    Frontend->>Frontend: 显示优化建议（如有冲突）

    User->>Frontend: 选择路线并确认
    Frontend->>TaskSvc: batchCreateTasks(tasks)
    TaskSvc->>DB: 批量更新 status=confirmed
    TaskSvc-->>Frontend: 成功
    Frontend->>Frontend: 显示创建成功
```

### 4.3 时间冲突检测与优化时序

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as 前端
    participant Agent as AgentController
    participant TaskSvc as TaskService
    participant ConflictOpt as ConflictOptimizer
    participant LLM as 大语言模型
    participant DB as 数据库

    User->>Frontend: 创建新任务
    Frontend->>Agent: POST /api/agent/chat
    Agent->>TaskSvc: createTask(args)

    TaskSvc->>DB: 保存任务 (pending)
    TaskSvc-->>Agent: 返回预览

    Agent-->>Frontend: 返回确认弹窗
    Frontend->>Frontend: 检测时间冲突
    Frontend->>TaskSvc: queryTasks(dateRange)
    TaskSvc->>DB: 查询该时间段任务
    DB-->>TaskSvc: 返回任务列表
    TaskSvc-->>Frontend: 返回 pending 任务

    Frontend->>Frontend: 计算重叠时间
    Frontend->>Frontend: 判断冲突程度

    alt 严重冲突（>15分钟）
        Frontend->>ConflictOpt: POST /api/agent/optimize-conflicts
        ConflictOpt->>DB: 查询冲突任务
        ConflictOpt->>ConflictOpt: 构建优化提示
        ConflictOpt->>LLM: call(优化任务)
        LLM-->>ConflictOpt: 返回优化方案
        ConflictOpt-->>Frontend: 返回优化建议

        Frontend->>Frontend: 显示优化弹窗
        Frontend->>Frontend: 显示优化建议
        Frontend->>Frontend: 显示思考过程
        Frontend->>Frontend: 显示会被修改的任务

        User->>Frontend: 选择优化方案
        Frontend->>TaskSvc: applyOptimization(solution)
        TaskSvc->>DB: 更新任务时间
        TaskSvc-->>Frontend: 成功
    end

    Frontend->>Frontend: 启用/禁用确认按钮
    User->>Frontend: 点击确认
    Frontend->>Agent: POST /api/agent/chat (confirm)
    Agent->>TaskSvc: confirmTask(taskId)
    TaskSvc->>DB: 更新 status=confirmed
    TaskSvc-->>Agent: 成功
    Agent-->>Frontend: 返回成功
```

### 4.4 智能重试时序

```mermaid
sequenceDiagram
    participant User as 用户
    participant AgentSvc as AgentService
    participant LLM as 大语言模型
    participant Tool as ToolExecutor
    participant Validator as ParamValidator

    AgentSvc->>LLM: stream(用户消息)
    LLM-->>AgentSvc: 返回工具调用
    AgentSvc->>Tool: executeTool(toolName, args)

    Tool->>Validator: validateToolParams(toolName, args)

    alt 参数错误
        Validator-->>Tool: 返回错误信息 + retryHint
        Tool-->>AgentSvc: 返回失败 + retryHint

        AgentSvc->>AgentSvc: 构建重试提示
        AgentSvc->>AgentSvc: 包含完整历史消息
        AgentSvc->>AgentSvc: 包含错误信息
        AgentSvc->>AgentSvc: 包含正确参数示例

        AgentSvc->>LLM: stream(retryPrompt, temperature=0.1)
        LLM-->>AgentSvc: 返回新工具调用
        AgentSvc->>AgentSvc: 解析新参数

        AgentSvc->>Tool: executeTool(toolName, newArgs)
        Tool->>Validator: validateToolParams(toolName, newArgs)
        Validator-->>Tool: 校验通过
        Tool->>Tool: 执行工具逻辑
        Tool-->>AgentSvc: 返回成功结果

        AgentSvc->>AgentSvc: 更新工具结果
        AgentSvc-->>User: 返回成功响应
    else 参数正确
        Validator-->>Tool: 校验通过
        Tool->>Tool: 执行工具逻辑
        Tool-->>AgentSvc: 返回成功结果
        AgentSvc-->>User: 返回成功响应
    end
```

---

## 5. 部署架构

### 5.1 系统架构图

```mermaid
graph TB
    subgraph 客户端
        A[微信小程序] --- B[H5 网页]
    end

    subgraph CDN
        C[静态资源 CDN]
    end

    subgraph 负载均衡
        D[Nginx 负载均衡]
    end

    subgraph 应用层
        E[Node.js 应用 1]
        F[Node.js 应用 2]
        G[Node.js 应用 N]
    end

    subgraph 后端服务
        H[NestJS Server 端口 3000]
    end

    subgraph 数据层
        I[Supabase PostgreSQL]
        J[Redis 缓存]
    end

    subgraph 外部服务
        K[高德地图 API]
        L[豆包大模型 API]
    end

    A --> D
    B --> D
    C --> D

    D --> E
    D --> F
    D --> G

    E --> H
    F --> H
    G --> H

    H --> I
    H --> J
    H --> K
    H --> L

    J -.缓存.-> I

    style A fill:#4CAF50
    style B fill:#2196F3
    style H fill:#FF9800
    style I fill:#9C27B0
    style K fill:#F44336
    style L fill:#E91E63
```

### 5.2 部署流程

```mermaid
flowchart TD
    Start[代码提交] --> GitPush[推送到 Git]
    GitPush --> CI[持续集成 pnpm validate + build]
    CI --> DockerBuild[构建 Docker 镜像]
    DockerBuild --> Registry[推送到镜像仓库]

    Registry --> CD[持续部署]
    CD --> DeployApp[部署应用]
    CD --> DeployWorker[部署 Worker]

    DeployApp --> HealthCheck[健康检查]
    HealthCheck --> Ready{就绪?}

    Ready -->|否| Rollback[回滚]
    Ready -->|是| Scale[扩容/缩容]

    Rollback --> DeployApp
    Scale --> Monitor[监控告警]

    style Start fill:#4CAF50
    style CI fill:#2196F3
    style CD fill:#FF9800
    style Monitor fill:#F44336
```

### 5.3 数据流

```mermaid
flowchart LR
    subgraph 输入
        A[用户输入]
        B[位置数据]
        C[时间数据]
    end

    subgraph 处理
        D[Agent 模块]
        E[Task 模块]
        F[Location 模块]
    end

    subgraph AI
        G[LLM 模型]
        H[冲突优化]
    end

    subgraph 存储
        I[PostgreSQL]
        J[Redis 缓存]
    end

    subgraph 输出
        K[任务列表]
        L[行程规划]
        M[统计报表]
    end

    A --> D
    B --> F
    C --> E

    D --> G
    D --> H

    E --> I
    F --> J

    G --> D
    H --> E

    E --> K
    F --> L
    D --> M

    style A fill:#4CAF50
    style I fill:#2196F3
    style G fill:#FF9800
```

---

## 📝 图例说明

### 流程图节点颜色

| 颜色 | 含义 |
|------|------|
| 🟢 绿色 (#4CAF50) | 开始/结束节点 |
| 🔵 蓝色 (#2196F3) | 核心处理节点（AI、数据库） |
| 🟠 橙色 (#FF9800) | 工具执行节点（API 调用、参数校验） |
| 🔴 红色 (#F44336) | 错误/重试节点 |
| 🟣 紫色 (#9C27B0) | 优化/分析节点 |

### ER 图符号

| 符号 | 含义 |
|------|------|
| `||` | 一对一关系 |
| `||--o{` | 一对多关系 |
| `}o--||` | 多对一关系 |
| `PK` | 主键 |
| `FK` | 外键 |
| `UK` | 唯一键 |

---

**文档版本**: v1.0.0
**最后更新**: 2025-04-09
**相关文档**: [完整架构文档](./ARCHITECTURE.md)
