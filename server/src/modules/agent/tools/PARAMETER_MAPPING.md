# 工具参数映射文档

## 设计原则

LLM 可能使用不同的参数名称调用工具，为了兼容性，每个工具执行器都需要进行参数别名映射。

## 参数映射表

### task_create
| 标准参数名 | 别名 |
|-----------|------|
| title | description, name, subject |
| scheduled_time | time, start_time, datetime |
| location_name | location, place |
| destination_name | destination, end_location, to |

### task_delete
| 标准参数名 | 别名 |
|-----------|------|
| task_id | id, task_id |
| filter.all | delete_all, clear_all |
| filter.date | day, target_date |

### task_update
| 标准参数名 | 别名 |
|-----------|------|
| task_id | id |
| filter.keyword | keyword, search |
| updates.scheduled_time | time, new_time |

### taxi_call
| 标准参数名 | 别名 |
|-----------|------|
| origin | start, from, start_location, pickup |
| destination | end, to, end_location, dropoff |
| scheduled_time | time, datetime, pickup_time |

### time_check
| 标准参数名 | 别名 |
|-----------|------|
| scheduled_time | time, datetime, check_time, target_time |
| duration_minutes | duration, length, minutes |

### calendar_check
| 标准参数名 | 别名 |
|-----------|------|
| date | day, check_date, target_date |
| time_range | range, period, time_period |

### trip_plan
| 标准参数名 | 别名 |
|-----------|------|
| origin | start, from, start_location |
| destination | end, to, end_location |
| departure_time | date, time, departure_date |
| preferred_mode | mode, preference, preferred_transport |

## 实现模式

每个工具执行器都应该在开头进行参数归一化：

```typescript
export async function executeToolName(args: any, userId: string): Promise<ToolResult> {
  // 参数别名映射（兼容 AI 返回的不同参数名）
  const normalizedArgs = {
    ...args,
    param1: args.param1 || args.alias1 || args.alias2,
    param2: args.param2 || args.alias3 || args.alias4,
  }

  const { param1, param2 } = normalizedArgs
  // ...
}
```

## 注意事项

1. **优先级**：标准参数名优先，别名作为后备
2. **日志**：参数映射后应该打印日志，方便调试
3. **文档同步**：definitions.ts 中的参数描述也应该提到别名
4. **必填校验**：映射后进行必填参数校验
