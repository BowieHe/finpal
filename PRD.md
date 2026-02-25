# FinPal - 乐观与悲观双人格 AI 对话系统 PRD

## 1. 项目背景

FinPal 是一个基于 LangGraph 和 OpenAI API 的双人格 AI 对话助手。它能够同时以乐观派和悲观派两个不同的人格视角回答用户的问题，帮助用户从多角度审视问题，做出更全面的决策。

**核心价值：**
- 提供平衡的视角，避免单一思维局限
- 增强决策的全面性和深度
- 适合风险评估、方案对比等场景

## 2. 功能需求

### 2.1 核心功能

#### 2.1.1 会话管理
- **新建会话**：创建新的对话会话，每个会话独立存储
- **会话列表**：左侧侧边栏展示所有会话，支持点击切换
- **会话删除**：删除不需要的会话
- **会话自动重命名**：基于第一条消息自动生成会话标题
- **会话持久化**：所有会话数据保存到 localStorage

#### 2.1.2 双人格对话
- **用户提问**：用户输入问题后，系统同时请求两个不同人格的回答
- **乐观派回答**：从积极、正面的角度分析问题
- **悲观派回答**：从谨慎、负面的角度分析问题
- **左右并排展示**：两个回答以独立卡片形式左右并排显示

#### 2.1.3 消息展示
- **对话气泡风格**：类似微信/WhatsApp 的消息流展示
- **用户消息**：居中显示，白色背景，圆角设计
- **时间戳**：每条消息显示发送时间
- **人格卡片**：包含 emoji 头像、人格名称、回答内容

#### 2.1.4 配置管理
- **API 配置**：支持自定义 API URL、Model Name、API Key
- **配置持久化**：配置保存到 localStorage
- **表单验证**：保存前验证配置有效性
- **默认配置**：
  - API URL：`https://api.deepseek.com/v1`
  - Model：`deepseek-reasoner`

#### 2.1.5 主题切换
- **明暗主题**：支持深色和浅色主题切换
- **主题持久化**：用户偏好保存到 localStorage
- **平滑过渡**：主题切换有动画过渡效果

### 2.2 辅助功能

#### 2.2.1 会话管理
- **会话标题自动生成**：基于第一条消息的前 N 个字符自动命名
- **会话快捷操作**：右键菜单支持删除、重命名
- **空状态提示**：没有会话时显示创建引导

#### 2.2.2 用户体验
- **加载状态**：请求 LLM 回答时显示加载动画
- **错误提示**：请求失败时显示友好错误信息
- **快捷键支持**：支持 Ctrl/Cmd + N 新建会话

## 3. 技术方案

### 3.1 技术栈

**前端框架：**
- Next.js 16.1.6 (React 全栈框架)
- React 19.2.4
- TypeScript 5.9.3

**UI 框架：**
- Tailwind CSS 4.2.0
- 原生 CSS 变量实现主题系统

**AI/LLM：**
- LangGraph 1.1.5 (应用编排框架)
- LangChain Core 1.1.26
- LangChain OpenAI 1.2.8
- OpenAI 兼容接口

**状态管理：**
- React Hooks (useState, useEffect)
- localStorage (数据持久化)

**表单处理：**
- HTML5 表单 + React state

### 3.2 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    FinPal App                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐         ┌─────────────────────────┐  │
│  │  Sidebar │         │        Main Content      │  │
│  │          │         │                         │  │
│  │ + 会话   │         │  ┌───────────────────┐  │  │
│  │ 会话1    │         │  │   Chat Area       │  │  │
│  │ 会话2    │         │  │                   │  │  │
│  │ 会话3    │         │  │  ┌─────────────┐  │  │  │
│  │ ...      │         │  │  │   消息气泡   │  │  │  │
│  │          │         │  │  │   (居中)     │  │  │  │
│  │ Settings │         │  │  └─────────────┘  │  │  │
│  │ Theme    │         │  │                   │  │  │
│  │ Toggle   │         │  │  ┌─────────────┐  │  │  │
│  │          │         │  │  │ 乐观派卡片  │  │  │  │
│  │          │         │  │  └─────────────┘  │  │  │
│  │          │         │  │  ┌─────────────┐  │  │  │
│  │          │         │  │  │悲观派卡片  │  │  │  │
│  │          │         │  │  └─────────────┘  │  │  │
│  │          │         │  │                   │  │  │
│  │          │         │  │   [输入框]        │  │  │
│  └──────────┘         │  └───────────────────┘  │  │
│                        └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 3.3 数据流

#### 会话管理流程
```
用户操作 → 更新 state → localStorage → 重新渲染
```

#### LLM 请求流程
```
用户输入 → 从 localStorage 读取配置 → 
请求 /api/chat → 后端验证配置 → 
创建 LLM 客户端 → 调用 Graph → 
返回双人格回答 → 更新 state → localStorage → UI 渲染
```

### 3.4 配置管理

#### 配置存储结构
```typescript
interface LLMConfig {
  apiUrl: string;        // API 地址，默认 https://api.deepseek.com/v1
  modelName: string;     // 模型名称，默认 deepseek-reasoner
  apiKey: string;        // API 密钥
}
```

#### localStorage 结构
```typescript
// 会话数据
conversations: {
  [id: string]: {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
  }
}

// 当前激活的会话 ID
currentConversationId: string

// LLM 配置
llmConfig: {
  apiUrl: string;
  modelName: string;
  apiKey: string;
}

// 主题设置
theme: 'light' | 'dark'
```

## 4. UI/UX 设计

### 4.1 布局设计

#### 主布局
```
┌─────────────────────────────────────────────────┐
│  Header: FinPal Logo + Theme Toggle + Settings │
├─────────┬───────────────────────────────────────┤
│ Sidebar│  Main Chat Area                        │
│         │                                       │
│ +       │  [用户问题气泡 - 居中]                  │
│ 会话1   │                                       │
│ 会话2   │  ┌──────────┐  ┌──────────┐           │
│ 会话3   │  │ 乐观派   │  │ 悲观派   │           │
│ ...     │  │ 卡片     │  │ 卡片     │           │
│         │  └──────────┘  └──────────┘           │
│         │                                       │
│         │  [更多消息...]                        │
│         │                                       │
│         │  [输入框 - 底部]                       │
└─────────┴───────────────────────────────────────┘
```

#### 侧边栏尺寸
- 宽度：260px
- 可折叠：展开/收起切换
- 折叠后宽度：60px

### 4.2 配色方案

#### 深色主题（默认）
**背景：**
- 主背景：`from-slate-900 via-purple-900 to-slate-900` (渐变)

**乐观派卡片：**
- 背景：`from-green-900/30 to-green-800/20`
- 边框：`border-green-700/30`
- 文字：`text-green-100`
- 标题：`text-green-400`
- Emoji：`😊`

**悲观派卡片：**
- 背景：`from-red-900/30 to-red-800/20`
- 边框：`border-red-700/30`
- 文字：`text-red-100`
- 标题：`text-red-400`
- Emoji：`😟`

**用户问题：**
- 背景：`bg-white/10`
- 边框：`border-white/20`
- 文字：`text-white`

**输入框：**
- 背景：`bg-slate-700/50`
- 边框：`border-slate-600`
- 占位符：`text-slate-400`

#### 浅色主题
**背景：**
- 主背景：`bg-slate-50`

**乐观派卡片：**
- 背景：`bg-green-50`
- 边框：`border-green-200`
- 文字：`text-green-700`
- 标题：`text-green-600`

**悲观派卡片：**
- 背景：`bg-red-50`
- 边框：`border-red-200`
- 文字：`text-red-700`
- 标题：`text-red-600`

**用户问题：**
- 背景：`bg-white`
- 边框：`border-slate-300`
- 文字：`text-slate-800`

**输入框：**
- 背景：`bg-white`
- 边框：`border-slate-300`

### 4.3 组件设计

#### 消息气泡
```
┌────────────────────────────────┐
│  12:30                         │
│                                │
│  这是一个很长的问题...          │
│                                │
└────────────────────────────────┘
```

**样式：**
- 居中显示
- 白色背景（浅色主题）
- 深色背景（深色主题）
- 圆角：12px
- 内边距：16px 24px
- 最大宽度：80%

#### 人格卡片
```
┌────────────────────────────────┐
│  😊  乐观派                     │
├────────────────────────────────┤
│  这是一个积极的分析...          │
│  - 关注机会和可能性            │
│  - 强调解决方案                │
│  - 用鼓励的语气...              │
└────────────────────────────────┘
```

**样式：**
- Emoji + 人格名称（顶部）
- 回答内容（主体）
- 悬停效果：轻微放大（scale-105）
- 阴影增强：shadow-lg

### 4.4 交互设计

#### 会话列表
- 新建会话：点击 "+" 按钮
- 切换会话：点击会话项
- 删除会话：长按或右键菜单
- 会话标题：灰色小字，最多显示 2 行

#### 设置模态框
- 模态框背景：半透明黑色遮罩
- 模态框内容：白色背景，居中显示
- 表单字段：
  - API URL（必填）
  - Model Name（必填）
  - API Key（必填）
- 操作按钮：保存、重置、取消

#### 主题切换
- 位置：右上角
- 样式：图标按钮
- 动画：平滑过渡（transition-colors duration-300）

### 4.5 响应式设计

#### 桌面端（≥768px）
- 侧边栏：始终可见，宽度 260px
- 两个卡片：左右并排
- 消息列表：滚动显示

#### 移动端（<768px）
- 侧边栏：隐藏（汉堡菜单按钮）
- 两个卡片：垂直堆叠
- 侧边栏切换：点击汉堡菜单

## 5. 数据结构

### 5.1 类型定义

#### Message
```typescript
interface Message {
  id: string;
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
  timestamp: number;
}
```

#### Conversation
```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
```

#### LLMConfig
```typescript
interface LLMConfig {
  apiUrl: string;
  modelName: string;
  apiKey: string;
}
```

#### Theme
```typescript
type Theme = 'light' | 'dark';
```

### 5.2 localStorage 键名
- `finpal_conversations` - 会话列表
- `finpal_current_conversation` - 当前会话 ID
- `finpal_llm_config` - LLM 配置
- `finpal_theme` - 主题设置

## 6. API 设计

### 6.1 Chat API

**端点：** `POST /api/chat`

**请求体：**
```json
{
  "question": "用户问题",
  "config": {
    "apiUrl": "https://api.deepseek.com/v1",
    "modelName": "deepseek-reasoner",
    "apiKey": "sk-..."
  }
}
```

**响应：**
```json
{
  "question": "用户问题",
  "optimisticAnswer": "乐观派回答内容",
  "pessimisticAnswer": "悲观派回答内容"
}
```

**错误响应：**
```json
{
  "error": "错误信息"
}
```

### 6.2 API 验证规则

- `apiUrl` 必须以 `/v1` 结尾（可配置）
- `modelName` 不能为空
- `apiKey` 不能为空
- API URL 必须是有效的 HTTPS 地址

## 7. 实现计划

### 7.1 开发阶段

#### Phase 1: 基础架构（Day 1）
- [ ] 定义类型系统
- [ ] 创建配置管理工具
- [ ] 修改 LLM 客户端支持动态配置
- [ ] 修改 Graph 工厂支持动态 LLM
- [ ] 更新 API 路由支持动态配置
- [ ] 创建主题系统

#### Phase 2: 会话管理（Day 1-2）
- [ ] 实现会话持久化
- [ ] 创建会话列表组件
- [ ] 创建新建会话功能
- [ ] 创建会话切换功能
- [ ] 创建会话删除功能
- [ ] 实现会话自动重命名

#### Phase 3: UI 优化（Day 2-3）
- [ ] 创建消息气泡组件
- [ ] 创建人格卡片组件
- [ ] 重构消息列表展示
- [ ] 优化输入框样式
- [ ] 实现响应式布局

#### Phase 4: 设置系统（Day 3）
- [ ] 创建设置模态框
- [ ] 实现配置表单
- [ ] 添加配置验证
- [ ] 实现保存/重置功能
- [ ] 集成主题切换

#### Phase 5: 主题系统（Day 4）
- [ ] 实现主题切换逻辑
- [ ] 适配深色主题
- [ ] 适配浅色主题
- [ ] 添加主题过渡动画
- [ ] 主题持久化

#### Phase 6: 测试和优化（Day 4-5）
- [ ] 功能测试
- [ ] UI/UX 优化
- [ ] 性能优化
- [ ] 错误处理增强
- [ ] 移动端适配测试

### 7.2 技术细节

#### LLM 客户端工厂
```typescript
// src/lib/llm/client.ts
export function createLLMClient(config: LLMConfig): ChatOpenAI {
  return new ChatOpenAI({
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.apiUrl,
    },
    temperature: 0.7,
    model: config.modelName,
  });
}
```

#### Graph 工厂
```typescript
// src/lib/graph/graph.ts
export function createGraph(llm: BaseChatModel) {
  const graph = new StateGraph({ annotation: GraphAnnotation })
    .addNode('optimistic', optimisticNode)
    .addNode('pessimistic', pessimisticNode)
    .addEdge(START, 'optimistic')
    .addEdge(START, 'pessimistic')
    .addEdge('optimistic', END)
    .addEdge('pessimistic', END);

  return graph.compile();
}
```

#### 会话管理工具
```typescript
// src/lib/conversation.ts
export function createConversation(title: string, messages: Message[]): Conversation;
export function getConversations(): Conversation[];
export function getCurrentConversation(): Conversation | null;
export function switchConversation(id: string): void;
export function createNewConversation(): string;
export function deleteConversation(id: string): void;
export function updateConversation(id: string, updates: Partial<Conversation>): void;
```

#### 配置管理工具
```typescript
// src/lib/config.ts
export function getLLMConfig(): LLMConfig;
export function setLLMConfig(config: LLMConfig): void;
export function validateLLMConfig(config: LLMConfig): boolean;
```

## 8. 后续优化方向

### 8.1 功能增强
- [ ] 导出会话对话（Markdown/PDF）
- [ ] 会话搜索功能
- [ ] 多模型切换
- [ ] 提示词模板自定义
- [ ] 对话分享链接

### 8.2 性能优化
- [ ] 懒加载会话
- [ ] 虚拟滚动优化
- [ ] 消息分页加载
- [ ] API 请求缓存

### 8.3 用户体验
- [ ] 语音输入
- [ ] 快捷键支持
- [ ] 国际化（i18n）
- [ ] 无障碍访问（a11y）

### 8.4 安全性
- [ ] API Key 加密存储
- [ ] 请求签名
- [ ] 使用限制
- [ ] 审计日志

## 9. 风险和挑战

### 9.1 技术风险
- **LLM 响应时间**：大模型推理可能较慢，需要优化加载体验
- **并发请求**：多个会话同时请求可能导致性能问题
- **数据持久化**：localStorage 容量限制，需要定期清理

### 9.2 安全风险
- **API Key 泄露**：存储在客户端存在泄露风险
- **越权访问**：需要验证 API Key 有效性

### 9.3 用户接受度
- **使用习惯**：从单会话到多会话需要用户适应
- **主题切换**：需要平衡不同用户的偏好

## 10. 验收标准

### 10.1 功能验收
- [ ] 会话创建、切换、删除功能正常
- [ ] 双人格回答正确显示
- [ ] 配置管理功能正常
- [ ] 主题切换流畅
- [ ] 数据持久化正常

### 10.2 性能验收
- [ ] 首屏加载 < 3s
- [ ] 消息列表滚动流畅
- [ ] API 响应时间 < 5s

### 10.3 UI/UX 验收
- [ ] 布局响应式适配
- [ ] 主题切换过渡平滑
- [ ] 错误提示友好

## 12. 现有代码分析与重构计划

### 12.1 当前项目结构

```
finpal/
├── src/
│   ├── app/
│   │   ├── page.tsx                # 主页面（需要重构）
│   │   ├── layout.tsx              # 全局布局（需要扩展）
│   │   ├── globals.css             # 全局样式（需要扩展）
│   │   └── api/chat/route.ts       # API 路由（需要修改）
│   ├── components/
│   │   ├── ChatInput.tsx           # 输入框（保留）
│   │   ├── MessageList.tsx         # 消息列表（需要重构）
│   │   ├── PersonaPanel.tsx        # 人格面板（🗑️ 删除）
│   │   └── Loading.tsx             # 加载组件（🗑️ 删除）
│   ├── lib/
│   │   ├── llm/client.ts           # LLM 客户端（需要重构）
│   │   ├── graph/
│   │   │   ├── graph.ts            # Graph 定义（需要重构）
│   │   │   ├── nodes.ts            # 节点（需要修改）
│   │   │   └── state.ts            # 状态定义（保留）
│   │   └── prompts.ts              # 人格 prompt（保留）
│   ├── types/
│   │   └── chat.ts                 # 类型定义（需要扩展）
│   └── utils/
│       └── format.ts               # 工具函数（保留）
```

### 12.2 需要删除的文件

#### 🗑️ `src/components/PersonaPanel.tsx`
**删除原因：**
- 从未被导入使用
- 功能与新的 UI 设计不符（PRD 要求独立卡片并排 + 气泡风格）
- MessageList 将完全重写，PersonaPanel 的功能会被合并到新组件中

#### 🗑️ `src/components/Loading.tsx`
**删除原因：**
- 从未被导入使用
- PRD 要求在消息列表中显示加载状态，而不是单独的加载页面
- 加载动画应该内联在聊天界面中

### 12.3 需要重构的文件

#### 🔄 `src/components/MessageList.tsx`
**当前状态：** 简单的消息列表展示
**需要重构为：** 气泡风格 + 独立卡片并排

**新组件结构：**
```
MessageList.tsx (容器)
├── MessageBubble.tsx (新组件 - 用户问题气泡)
└── PersonaCard.tsx x 2 (新组件 - 乐观/悲观卡片，左右并排)
```

**重构内容：**
- 从网格布局改为气泡流式布局
- 用户问题居中显示
- 乐观/悲观卡片左右并排
- 支持加载状态显示

#### 🔄 `src/app/page.tsx`
**当前状态：** 简单的单会话聊天
**需要重构为：** 侧边栏 + 会话管理 + 设置 + 主题切换

**重构内容：**
- 集成侧边栏组件
- 添加会话管理逻辑（新建、切换、删除）
- 添加设置模态框管理
- 添加主题切换逻辑
- 集成新的 MessageList 组件

#### 🔄 `src/types/chat.ts`
**当前状态：** 只有基础 Message 类型
**需要扩展为：** 多个类型文件

**重构为：**
```typescript
// src/types/chat.ts - 保留基础类型
export interface Message {
  id: string;
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
  timestamp: number;
}

// src/types/conversation.ts (新增)
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// src/types/config.ts (新增)
export interface LLMConfig {
  apiUrl: string;
  modelName: string;
  apiKey: string;
}

export type Theme = 'light' | 'dark';
```

#### 🔄 `src/lib/llm/client.ts`
**当前状态：** 全局 `llm` 实例
**需要重构为：** 工厂函数支持动态配置

**重构内容：**
```typescript
// 旧代码
export const llm = new ChatOpenAI({
  openAIApiKey: apiKey,
  configuration: { baseURL },
  temperature: 0.7,
  model,
});

// 新代码
export function createLLMClient(config: LLMConfig): ChatOpenAI {
  return new ChatOpenAI({
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.apiUrl,
    },
    temperature: 0.7,
    model: config.modelName,
  });
}

// 保留默认配置作为 fallback
export const defaultLLMConfig: LLMConfig = {
  apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1',
  modelName: process.env.OPENAI_MODEL || 'deepseek-reasoner',
  apiKey: process.env.OPENAI_API_KEY || '',
};
```

#### 🔄 `src/lib/graph/nodes.ts`
**当前状态：** 从全局 `llm` 导入
**需要重构为：** 接收 LLM 实例作为参数

**重构内容：**
```typescript
// 旧代码
import { llm } from '../llm/client';

export const optimisticNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const prompt = `${OPTIMISTIC_PROMPT}\n\n问题: ${state.question}\n\n请回答:`;
  const response = await llm.invoke(prompt);
  return { optimisticAnswer: response.content as string };
};

// 新代码
export const createOptimisticNode = (llm: BaseChatModel) => {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const prompt = `${OPTIMISTIC_PROMPT}\n\n问题: ${state.question}\n\n请回答:`;
    const response = await llm.invoke(prompt);
    return { optimisticAnswer: response.content as string };
  };
};

export const createPessimisticNode = (llm: BaseChatModel) => {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const prompt = `${PESSIMISTIC_PROMPT}\n\n问题: ${state.question}\n\n请回答:`;
    const response = await llm.invoke(prompt);
    return { pessimisticAnswer: response.content as string };
  };
};
```

#### 🔄 `src/lib/graph/graph.ts`
**当前状态：** 全局 `chatGraph` 实例
**需要重构为：** 工厂函数支持动态 LLM

**重构内容：**
```typescript
// 旧代码
export const chatGraph = createGraph();

// 新代码
export function createGraph(llm: BaseChatModel) {
  const optimisticNode = createOptimisticNode(llm);
  const pessimisticNode = createPessimisticNode(llm);

  const graph = new StateGraph({ annotation: GraphAnnotation })
    .addNode('optimistic', optimisticNode)
    .addNode('pessimistic', pessimisticNode)
    .addEdge(START, 'optimistic')
    .addEdge(START, 'pessimistic')
    .addEdge('optimistic', END)
    .addEdge('pessimistic', END);

  return graph.compile();
}
```

### 12.4 需要更新的文件

#### 📝 `.env.local.example`
**更新内容：**
```bash
# 旧配置
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# 新配置（DeepSeek 默认）
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-reasoner
```

#### 📝 `src/app/globals.css`
**更新内容：** 添加主题 CSS 变量

```css
:root {
  /* 深色主题（默认） */
  --background-start: #0f172a;
  --background-middle: #581c87;
  --background-end: #0f172a;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --card-bg: rgba(30, 41, 59, 0.5);
  --border-color: rgba(148, 163, 184, 0.2);
}

[data-theme="light"] {
  /* 浅色主题 */
  --background-start: #f8fafc;
  --background-middle: #f8fafc;
  --background-end: #f8fafc;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --card-bg: rgba(255, 255, 255, 1);
  --border-color: rgba(148, 163, 184, 0.3);
}
```

#### 📝 `src/app/api/chat/route.ts`
**更新内容：** 支持动态配置

```typescript
// 旧代码
import { chatGraph } from '@/lib/graph/graph';

const result = await chatGraph.invoke({
  question,
  optimisticAnswer: '',
  pessimisticAnswer: '',
});

// 新代码
import { createGraph } from '@/lib/graph/graph';
import { createLLMClient } from '@/lib/llm/client';

const { question, config } = await request.json();

// 创建 LLM 客户端
const llm = createLLMClient(config);

// 创建 Graph
const graph = createGraph(llm);

const result = await graph.invoke({
  question,
  optimisticAnswer: '',
  pessimisticAnswer: '',
});
```

### 12.5 新增文件清单

#### 新增组件文件：
- `src/components/Sidebar.tsx` - 侧边栏组件
- `src/components/ConversationList.tsx` - 会话列表
- `src/components/ConversationItem.tsx` - 单个会话项
- `src/components/MessageBubble.tsx` - 消息气泡
- `src/components/PersonaCard.tsx` - 人格卡片
- `src/components/SettingsModal.tsx` - 设置模态框
- `src/components/SettingsForm.tsx` - 设置表单
- `src/components/ThemeToggle.tsx` - 主题切换

#### 新增工具文件：
- `src/lib/config.ts` - 配置管理工具
- `src/lib/conversation.ts` - 会话管理工具

#### 新增类型文件：
- `src/types/conversation.ts` - 会话类型
- `src/types/config.ts` - 配置类型

### 12.6 重构执行顺序

**阶段 1：清理和准备**
1. ✅ 删除 `src/components/PersonaPanel.tsx`
2. ✅ 删除 `src/components/Loading.tsx`
3. ✅ 更新 `.env.local.example`

**阶段 2：类型和工具**
4. ✅ 创建 `src/types/conversation.ts`
5. ✅ 创建 `src/types/config.ts`
6. ✅ 创建 `src/lib/config.ts`
7. ✅ 创建 `src/lib/conversation.ts`

**阶段 3：后端重构**
8. ✅ 重构 `src/lib/llm/client.ts`（工厂函数）
9. ✅ 重构 `src/lib/graph/nodes.ts`（参数化）
10. ✅ 重构 `src/lib/graph/graph.ts`（工厂函数）
11. ✅ 更新 `src/app/api/chat/route.ts`（动态配置）

**阶段 4：前端组件**
12. ✅ 创建 `src/components/MessageBubble.tsx`
13. ✅ 创建 `src/components/PersonaCard.tsx`
14. ✅ 重构 `src/components/MessageList.tsx`

**阶段 5：侧边栏和会话**
15. ✅ 创建 `src/components/ConversationItem.tsx`
16. ✅ 创建 `src/components/ConversationList.tsx`
17. ✅ 创建 `src/components/Sidebar.tsx`

**阶段 6：设置和主题**
18. ✅ 创建 `src/components/SettingsForm.tsx`
19. ✅ 创建 `src/components/SettingsModal.tsx`
20. ✅ 创建 `src/components/ThemeToggle.tsx`

**阶段 7：集成和优化**
21. ✅ 更新 `src/app/globals.css`（主题变量）
22. ✅ 重构 `src/app/page.tsx`（集成所有功能）
23. ✅ 更新 `src/app/layout.tsx`（主题 provider）

### 12.7 文件操作总结

| 操作类型 | 数量 | 文件 |
|---------|------|------|
| **删除** | 2 | `PersonaPanel.tsx`, `Loading.tsx` |
| **重构** | 5 | `MessageList.tsx`, `page.tsx`, `client.ts`, `nodes.ts`, `graph.ts` |
| **扩展** | 1 | `types/chat.ts` |
| **更新** | 4 | `.env.local.example`, `globals.css`, `layout.tsx`, `route.ts` |
| **新增** | 13 | 8 个组件 + 2 个工具 + 3 个类型 |
| **保留** | 其余 | `prompts.ts`, `state.ts`, `format.ts`, `ChatInput.tsx`, 配置文件等 |

## 13. 附录

### 13.1 默认配置
```json
{
  "apiUrl": "https://api.deepseek.com/v1",
  "modelName": "deepseek-reasoner"
}
```

### 11.2 技术文档
- Next.js: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- LangGraph: https://langchain-ai.github.io/langgraph/

### 11.3 相关资源
- OpenAI API: https://platform.openai.com/docs
- DeepSeek API: https://platform.deepseek.com/docs

---

**文档版本：** v1.0
**创建日期：** 2026-02-25
**最后更新：** 2026-02-25
**作者：** FinPal Team
