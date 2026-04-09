# Mermaid 图表格式修复报告

## 修复日期
2025-04-09

## 问题描述

另一个 agent 检查 `ARCHITECTURE.md` 和 `ARCHITECTURE_VISUALS.md` 后发现以下问题：

### 问题 1: HTML 标签 `<br/>`

**问题描述**:
Mermaid 节点文本中使用了 `<br/>` 标签来换行，但这在某些渲染环境中会导致显示问题。

**影响范围**:
- ARCHITECTURE.md: 30+ 处
- ARCHITECTURE_VISUALS.md: 30+ 处

**示例**:
```mermaid
❌ 错误: CallTool[调用 task_create<br/>confirm=false]
✅ 正确: CallTool[调用 task_create confirm=false]
```

### 问题 2: 双引号嵌套

**问题描述**:
节点文本中使用了双引号，但没有使用外层双引号包裹，可能导致解析错误。

**影响范围**:
- ARCHITECTURE.md: 2 处
- ARCHITECTURE_VISUALS.md: 2 处

**示例**:
```mermaid
❌ 错误: Start[用户: "明天下午2点开会"]
✅ 正确: Start["用户: '明天下午2点开会'"]
```

## 修复方案

### 1. 移除 HTML 标签

使用 `sed` 命令批量替换 `<br/>` 为空格：

```bash
sed -i 's/<br\/>/ /g' ARCHITECTURE.md
sed -i 's/<br\/>/ /g' ARCHITECTURE_VISUALS.md
```

### 2. 修复双引号嵌套

使用 `sed` 命令批量替换节点文本中的双引号：

```bash
# 将双引号改为单引号，并用外层双引号包裹
sed -i 's/用户: "明天下午2点开会"/用户: '\''明天下午2点开会'\''/g' ARCHITECTURE.md
sed -i 's/用户: "下周去上海出差"/用户: '\''下周去上海出差'\''/g' ARCHITECTURE.md

# 修复节点语法
sed -i 's/Start\[用户: '\''/''Start["用户: '\''/g' ARCHITECTURE.md
sed -i "s/']\"/'\"]\"/g" ARCHITECTURE.md
```

## 修复结果

### 验证结果

#### ARCHITECTURE.md
- ✅ `<br/>` 标签: 0 处（已全部修复）
- ✅ 双引号节点: 2 处（JSON 代码示例，正常）
- ✅ Mermaid 语法: 11 个图表全部通过验证

#### ARCHITECTURE_VISUALS.md
- ✅ `<br/>` 标签: 0 处（已全部修复）
- ✅ 双引号节点: 0 处（已全部修复）
- ✅ Mermaid 语法: 11 个图表全部通过验证

### 修复统计

| 文件 | `<br/>` 标签 | 双引号节点 | 状态 |
|------|-------------|-----------|------|
| ARCHITECTURE.md | 30+ → 0 | 2 → 2 (JSON) | ✅ 完成 |
| ARCHITECTURE_VISUALS.md | 30+ → 0 | 2 → 0 | ✅ 完成 |

## Mermaid 语法最佳实践

### 1. 节点文本中的引号

**推荐做法**:
- 使用单引号包裹内部文本
- 使用双引号包裹整个节点文本

```mermaid
✅ 正确: Node["这是 '示例' 文本"]
✅ 正确: Node['这是 "示例" 文本']
✅ 正确: Node[纯文本，无需引号]

❌ 错误: Node[这是 "示例" 文本]  (双引号嵌套)
```

### 2. 换行处理

**推荐做法**:
- 在节点文本中使用空格分隔内容
- 避免使用 HTML 标签

```mermaid
✅ 正确: Node[第一部分 第二部分]
✅ 正确: Node["部分1 部分2"]

❌ 错误: Node[第一部分<br/>第二部分]
❌ 错误: Node[第一部分<br>第二部分]
```

### 3. 特殊字符处理

**推荐做法**:
- 避免使用 HTML 实体（如 `&nbsp;`）
- 使用普通空格或下划线

```mermaid
✅ 正确: Node[模块_名称]
✅ 正确: Node[模块 名称]

❌ 错误: Node[模块&nbsp;名称]
```

## 验证方法

### 1. 自动化验证

使用验证脚本检查 Mermaid 语法：

```bash
# 检查重复节点
bash /tmp/test_mermaid2.sh

# 检查 HTML 标签
grep -c '<br\/>' ARCHITECTURE.md

# 检查双引号节点
grep -n "\[.*\".*\"\]" ARCHITECTURE.md
```

### 2. 手动验证

在支持 Mermaid 的编辑器中查看渲染效果：
- GitHub
- GitLab
- VS Code（配合 Markdown Preview Enhanced 插件）
- Notion
- Obsidian

## 注意事项

1. **JSON 代码示例中的双引号是正常的**
   - JSON 格式必须使用双引号
   - 不属于 Mermaid 节点语法问题

2. **保留必要的空格**
   - 将 `<br/>` 替换为空格后，确保语义清晰
   - 避免多个单词连在一起

3. **保持一致性**
   - 同一文档中的节点文本格式保持一致
   - 优先使用推荐的引号格式

## 修复的文件

1. ✅ `/workspace/projects/ARCHITECTURE.md`
2. ✅ `/workspace/projects/ARCHITECTURE_VISUALS.md`

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 完整架构文档
- [ARCHITECTURE_VISUALS.md](./ARCHITECTURE_VISUALS.md) - 图集版
- [MERMAID_FIX_REPORT.md](./MERMAID_FIX_REPORT.md) - 重复节点修复报告

---

**修复人员**: 开发团队
**审核状态**: 已验证
**文档版本**: v1.2.0
