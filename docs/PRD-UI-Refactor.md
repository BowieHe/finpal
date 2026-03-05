# FinPal UI 重构 PRD 文档

## 1. 项目概述

将 FinPal 的搜索结果展示和 LLM 输出改为实时流式显示，提升用户体验。

## 2. 核心改动

### 2.1 通用组件：TypewriterText（打字机效果）

**新文件**: `src/components/TypewriterText.tsx`

**功能**:
- 接收文本流，逐字显示
- 支持自定义速度
- 支持完成回调
- 支持暂停/继续

**Props**:
```typescript
interface TypewriterTextProps {
  text: string;              // 当前已接收的文本
  isStreaming?: boolean;     // 是否还在流式接收中
  speed?: number;            // 打字速度（ms/字）
  onComplete?: () => void;   // 完成回调
  className?: string;
}
```

**使用场景**:
- 研究总结逐字显示
- 双人格对话逐字显示
- 任何 LLM 生成的文本

---

### 2.2 DebateBubble 组件修改

**文件**: `src/components/DebateBubble.tsx`

**修改内容**:
- 时间戳统一移到右下角
- 移除中间底部的时间戳位置

---

### 2.3 实时搜索进度简化

**文件**: `src/components/MessageList.tsx`

**修改内容**:
- 删除内联的实时搜索结果列表
- 只保留：
  - Deep Research 图标
  - 状态文字（"正在搜索: xxx"）
  - 进度条
  - 查询统计

---

### 2.4 搜索结果统一渲染

**文件**: 
- `src/components/MessageList.tsx`
- `src/components/ResearchResults.tsx`

**修改内容**:

1. **搜索过程中**就用 `ResearchResults` 组件渲染
2. **正在搜索的条目**：
   - 边框闪烁动画（CSS animation）
   - 显示状态文字："正在搜索..."
3. **已完成的条目**：
   - 正常显示（可折叠）
4. **删除**：搜索完成后再渲染一次最终结果的重复逻辑

**闪烁动画 CSS**:
```css
@keyframes border-pulse {
  0%, 100% { border-color: rgba(99, 102, 241, 0.3); }
  50% { border-color: rgba(99, 102, 241, 1); }
}
.searching-item {
  animation: border-pulse 1.5s ease-in-out infinite;
}
```

---

### 2.5 研究总结流式显示

**后端修改**:
- `src/app/api/chat/route.ts`
- 将研究总结改为流式输出（SSE）
- 每生成一段文字就发送一个事件

**前端修改**:
- `src/components/ResearchResults.tsx`
- 使用 `TypewriterText` 组件逐字显示
- 实时更新已接收的文本

---

### 2.6 双人格对话实时显示

**文件**:
- `src/app/api/chat/route.ts`（后端流式输出）
- `src/components/MessageList.tsx`（前端实时显示）
- `src/components/TimelineDebate.tsx`（支持动态添加）

**显示顺序**:
1. 乐观初始观点（逐字显示）
2. 悲观初始观点（逐字显示）
3. 悲观反驳（逐字显示）
4. 乐观反驳（逐字显示）
5. Decider 判断是否需要继续
   - 如果 `shouldContinue: true`，回到步骤 3
   - 如果 `shouldContinue: false`，显示最终总结

**等待状态**:
- 使用微信风格的三个跳动点
- CSS 动画实现

**跳动点 CSS**:
```css
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
.dot {
  animation: bounce 1.4s ease-in-out infinite both;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
```

---

### 2.7 最终总结显示

**文件**: `src/components/MessageList.tsx`

**位置**: 双人格对话之后

**显示方式**:
- 使用 `TypewriterText` 逐字显示
- 或者一次性显示（根据性能考虑）

---

## 3. 需要删除的功能

| 功能 | 位置 | 原因 |
|------|------|------|
| 顶部 ResearchProgress 组件 | `page.tsx` | 搜索结果移到消息卡片中 |
| 内联实时搜索结果列表 | `MessageList.tsx` | 统一使用 ResearchResults |
| 搜索结果重复渲染逻辑 | `MessageList.tsx` | 搜索过程中已经渲染 |
| 双人格一次性显示逻辑 | `TimelineDebate.tsx` | 改为实时逐个显示 |

---

## 4. API 改动

### 4.1 当前 SSE 事件类型

```
planning -> searching -> search_result -> analyzing -> complete
```

### 4.2 新 SSE 事件类型

```
planning -> searching -> search_result -> analyzing -> 
optimistic_initial -> pessimistic_initial -> 
[悲观反驳 -> 乐观反驳 -> decider -> (repeat if shouldContinue)] -> 
summary -> complete
```

**新增事件**:
- `optimistic_initial`: 乐观派初始观点（流式）
- `pessimistic_initial`: 悲观派初始观点（流式）
- `optimistic_rebuttal`: 乐观派反驳（流式）
- `pessimistic_rebuttal`: 悲观派反驳（流式）
- `decider`: 裁决者判断（包含 shouldContinue, winner, summary）
- `summary`: 最终总结（流式）

---

## 5. 实施顺序

### Phase 1: 基础组件
1. 创建 `TypewriterText` 组件
2. 修改 `DebateBubble` 时间戳位置
3. 添加跳动点动画组件

### Phase 2: 搜索功能
4. 简化实时搜索进度显示
5. 修改 `ResearchResults` 支持搜索中状态（边框闪烁）
6. 统一搜索结果渲染逻辑

### Phase 3: 双人格对话
7. 修改后端 API 支持流式输出双人格对话
8. 修改 `TimelineDebate` 支持动态添加消息
9. 实现实时显示逻辑

### Phase 4: 总结流式显示
10. 修改后端 API 流式输出总结
11. 前端使用 `TypewriterText` 显示总结

---

## 6. 问题确认

1. **双人格对话轮次**：目前设计是初始观点 → 反驳轮次（可多次）→ 总结。这个流程对吗？

2. **打字机速度**：统一使用 30ms/字 的速度，还是需要不同场景不同速度？

3. **流式输出优先级**：是先做双人格流式，还是先做总结流式，还是同时进行？

4. **向后兼容**：是否需要支持非流式模式（比如旧数据）？

## 7. 可以删除的代码

### 7.1 组件删除

| 文件 | 删除内容 | 原因 |
|------|----------|------|
| `src/components/ResearchProgress.tsx` | 整个组件 | 功能移到 MessageList |
| `src/components/ResearchProgress.test.tsx` | 整个测试文件 | 组件删除 |

### 7.2 代码删除

| 文件 | 删除内容 | 原因 |
|------|----------|------|
| `src/app/page.tsx` | ResearchProgress import | 组件删除 |
| `src/app/page.tsx` | ResearchState interface | 不再需要 |
| `src/app/page.tsx` | researchState state | 移到消息中 |
| `src/app/page.tsx` | searchResults state | 移到消息中 |
| `src/app/page.tsx` | ResearchProgress 渲染 | 组件删除 |
| `src/components/MessageList.tsx` | 内联搜索结果列表 | 统一使用 ResearchResults |
| `src/components/MessageList.tsx` | currentResearch prop | 不再需要 |

### 7.3 类型删除

| 文件 | 删除内容 | 原因 |
|------|----------|------|
| `src/types/conversation.ts` | 检查是否有废弃类型 | 重构后清理 |

---

**创建时间**: 2026-03-04
**版本**: 1.0
