# 情感AI伴侣 — Code Wiki

> 本文档基于对仓库源码的逐文件分析生成，描述**真实实现**（而非仅凭设计文档），包含架构、模块、数据流、API、数据结构、配置、运行方式与已知问题。

---

## 1. 项目概述

**情感AI伴侣**（`package.json` 中的项目名为 `trae-project`）是一个「个人情感辅助 AI」应用，核心能力是通过**多模态学习**吸收用户上传的恋爱/情感相关资料，定制出**专属 AI 人格**，并在对话中基于这些知识进行 **RAG 增强回复**。

核心闭环（三步）：

```
上传资料 → 多模态内容提取 → 向量化存储
        → 基于资料生成人格(系统提示词 + 知识图谱)
        → 对话时检索知识(RAG) + LLM 生成回复
```

技术形态为前后端一体的单体应用：
- 前端：React SPA，主要数据存于浏览器 `localStorage`（Zustand `persist`）。
- 后端：Express API 服务，数据以 JSON 文件 + 可选 Qdrant 向量库持久化。
- 部署：同时支持本地 `tsx` 运行与 Vercel Serverless（`api/index.ts`）。

---

## 2. 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | React 18 + TypeScript 5.8 | 函数组件 + Hooks |
| 构建工具 | Vite 6 | 开发服务器端口 5174，代理 `/api` |
| 路由 | react-router-dom 7 | `BrowserRouter` |
| 样式 | Tailwind CSS 3 + tailwind-merge/clsx | `darkMode: "class"` |
| 状态管理 | Zustand 5（`persist` 中间件） | 本地持久化到 `localStorage` |
| 图标 | lucide-react | 线条图标 |
| 后端框架 | Express 4 | `cors` + `dotenv` + `multer` |
| AI 服务 | `openai` SDK 4 | 兼容任意 OpenAI 协议端点（当前指向 Minimax） |
| 向量库 | Qdrant（`@qdrant/js-client-rest`） | 可选，失败自动降级 |
| 多模态 | fluent-ffmpeg / tesseract.js / pdf-parse / OpenAI Whisper | 视频抽帧、OCR、PDF、语音转写 |
| ID 生成 | uuid 11 | 前后端均用 `v4` |
| 本地运行 | tsx + nodemon | 后端热重载 |

---

## 3. 目录结构

```
sisterPrj/
├── api/                          # 后端 (Express)
│   ├── index.ts                  # Vercel serverless 入口
│   ├── server.ts                 # 本地开发入口 (端口 3001)
│   ├── app.ts                    # Express 应用装配、路由挂载、中间件
│   ├── routes/
│   │   ├── auth.ts               # 认证路由 (空 TODO)
│   │   ├── chat.ts               # 聊天/会话路由
│   │   ├── learn.ts              # 上传/资料/人格(重复) 路由
│   │   └── persona.ts            # 人格 CRUD/激活/反馈/反思/聊天 路由
│   ├── services/
│   │   ├── chat.ts               # 通用对话生成、道德过滤
│   │   ├── multimodal.ts         # 视频/音频/图片/PDF/文本处理
│   │   ├── personaAgent.ts       # 人格 Agent (Think/Execute/Reflect)
│   │   └── vectorStore.ts        # Qdrant 向量存储 + Hash 降级
│   └── data/
│       └── store.ts              # materials/personas JSON 持久化
├── src/                          # 前端 (React)
│   ├── main.tsx                  # 应用入口
│   ├── App.tsx                   # 路由定义
│   ├── index.css                 # Tailwind 指令/全局样式
│   ├── pages/                    # 6 个页面组件
│   │   ├── Home.tsx  Chat.tsx  Diary.tsx
│   │   ├── Learn.tsx  Settings.tsx  Profile.tsx
│   ├── stores/                   # Zustand 状态
│   │   ├── chatStore.ts  diaryStore.ts
│   │   ├── learnStore.ts  settingsStore.ts
│   ├── hooks/useTheme.ts         # 主题 Hook (未在页面使用)
│   ├── components/Empty.tsx      # 空组件 (未使用)
│   └── lib/utils.ts              # cn() 类名合并
├── data/
│   ├── materials.json            # 学习资料持久化文件
│   └── personas.json             # 人格持久化文件
├── uploads/                      # 上传文件存储目录 (含 frames/)
├── .trae/documents/              # PRD / 架构文档（设计参考）
├── .env                          # 环境变量（含 API Key，勿提交）
├── vercel.json  vite.config.ts  tailwind.config.js
├── tsconfig.json  nodemon.json  postcss.config.js  eslint.config.js
└── test-chat.ps1                 # 人格聊天测试脚本
```

---

## 4. 整体架构

```
┌─────────────────────────── 浏览器 (React SPA) ───────────────────────────┐
│  Home / Chat / Diary / Learn / Settings / Profile                        │
│  Zustand stores (localStorage 持久化)                                     │
└────────────────────────────────┬──────────────────────────────────────────┘
                                 │ fetch('/api/...')  (Vite 代理 → 3001)
┌────────────────────────────────▼──────────────────────────────────────────┐
│  Express 服务 (api/app.ts)                                                │
│   /api/auth   /api/learn (含 persona)   /api/chat   /api/health           │
│                                                                            │
│   Routes ──► Services ──► OpenAI 兼容 API (Minimax)                       │
│                    │                                                       │
│                    ├─► data/store.ts ──► data/*.json                       │
│                    └─► vectorStore.ts ──► Qdrant (或 Hash 降级)            │
└───────────────────────────────────────────────────────────────────────────┘
```

关键点：
- 后端**会话数据存内存数组**（重启即失），**资料/人格存 JSON 文件**。
- 前端**聊天/日记/设置/人格选择**存 `localStorage`。
- `personaRoutes` 实际挂载在 `/api/learn` 前缀下（见 §5.3）。

---

## 5. 后端详解

### 5.1 入口与启动

| 文件 | 作用 |
|------|------|
| [server.ts](file:///d:/MyCode/sisterPrj/api/server.ts) | 本地入口，`app.listen(PORT || 3001)`，处理 `SIGTERM`/`SIGINT` 优雅关闭 |
| [index.ts](file:///d:/MyCode/sisterPrj/api/index.ts) | Vercel serverless 入口，`export default (req,res)=>app(req,res)` |
| [app.ts](file:///d:/MyCode/sisterPrj/api/app.ts) | 装配中间件与路由 |

`app.ts` 中间件顺序：
1. `cors()`
2. `express.json({ limit: '10mb', verify: ... })`（保存 `req.rawBody`）
3. `express.urlencoded({ extended: true, limit: '10mb' })`
4. 统一设置 `Content-Type: application/json; charset=utf-8`
5. `express.static` 暴露 `/uploads`
6. 挂载路由（见下）
7. 健康检查、错误处理、404 处理

### 5.2 数据存储层 `data/store.ts`

职责：以**内存缓存 + JSON 文件**双写方式管理两类实体。

- `Material`：`id, title, description, type, filePath, status, summary?, content?, createdAt`
- `Persona`：`id, name, description, style, systemPrompt, knowledgeGraph, rules, isActive, createdAt, updatedAt, stats, materialIds?`

主要函数：

| 函数 | 说明 |
|------|------|
| `loadMaterials()` / `loadPersonas()` | 从 JSON 读取到内存缓存（`createdAt/updatedAt` 转回 `Date`） |
| `saveMaterials()` / `savePersonas()` | 写回 JSON；注意 `saveMaterials` 会把 `filePath` 置为 `undefined`（序列化时被剔除） |
| `getMaterials()` / `getPersonas()` | 返回内存缓存 |
| `addMaterial()` / `addPersona()` | 追加并保存 |
| `updatePersona()` / `deletePersona()` | 更新/删除并保存 |
| `getPersonaById(id)` | 按 id 查询 |

> 缓存为模块级变量，模块被加载一次后常驻；`routes/persona.ts` 与 `routes/learn.ts` 顶层调用 `loadMaterials()/loadPersonas()` 完成初始化。

### 5.3 路由层

路由挂载（`app.ts`）：

```
app.use('/api/auth', authRoutes)
app.use('/api/learn', learnRoutes)
app.use('/api/learn', personaRoutes)   // ⚠️ 注意：persona 也挂在 /api/learn 下
app.use('/api/chat', chatRoutes)
```

#### auth.ts
- `POST /api/auth/register`、`/login`、`/logout`：**空实现**（仅注释 TODO，未返回响应）。

#### learn.ts（挂载 `/api/learn`）
- `POST /upload`：`multer` 单文件上传（限 100MB），`detectFileType()` 自动识别类型，创建 `status='processing'` 的 `Material`，调用多模态处理，完成后更新 `summary/content/status='completed'`，并 `addVectors` 写入向量库（失败仅告警不中断）。
- `GET /materials`、`GET /materials/:id`、`DELETE /materials/:id`：资料查询/删除（删除时同步删除本地文件）。
- `GET /local-files`：列出 `uploads/` 目录文件元信息。
- `POST /persona`：**与 persona.ts 重复**（同路径，实际由先注册的 learn.ts 响应），逻辑一致。

#### persona.ts（挂载 `/api/learn`）
- `POST /persona`：从 `materialIds` 筛选 `status='completed'` 资料，调用 `generatePersonaFromMaterials`；若无资料则 400。
- `GET /personas`、`GET /persona/:id`
- `PUT /persona/:id/activate`：将指定人格设为 `isActive`，其余置 `false`。
- `PUT /persona/:id`：局部更新。
- `DELETE /persona/:id`
- `POST /persona/:id/feedback`：累加 `stats`（positive→+1，negative→-1，neutral→0）。
- `POST /persona/:id/reflect`：调用 `PersonaAgent.reflect()`。
- `POST /persona/:id/chat`：创建 `PersonaAgent`，执行 `process()`（Think→Execute）。

#### chat.ts（挂载 `/api/chat`）
- `POST /chat`：核心对话入口。维护**内存会话数组**；支持 `personaId`、`useRag`、`image`(base64)。图片走 `analyzeImage`。若指定 persona，则通过 `fetch` 调用 `/api/learn/persona/:id/chat`，否则走 `generateResponse`。返回 `response/conversationId/title/imageAnalysis`。
- `GET /conversations`、`GET /conversations/:id`、`DELETE /conversations/:id`。

### 5.4 API 端点清单（真实）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（TODO 空） |
| POST | `/api/auth/login` | 登录（TODO 空） |
| POST | `/api/auth/logout` | 登出（TODO 空） |
| POST | `/api/learn/upload` | 上传并处理多模态文件 |
| GET | `/api/learn/materials` | 资料列表 |
| GET | `/api/learn/materials/:id` | 资料详情 |
| DELETE | `/api/learn/materials/:id` | 删除资料 |
| GET | `/api/learn/local-files` | 上传目录文件列表 |
| POST | `/api/learn/persona` | 创建人格（learn.ts 生效） |
| GET | `/api/learn/personas` | 人格列表 |
| GET | `/api/learn/persona/:id` | 人格详情 |
| PUT | `/api/learn/persona/:id/activate` | 激活人格 |
| PUT | `/api/learn/persona/:id` | 更新人格 |
| DELETE | `/api/learn/persona/:id` | 删除人格 |
| POST | `/api/learn/persona/:id/feedback` | 提交反馈 |
| POST | `/api/learn/persona/:id/reflect` | 触发反思 |
| POST | `/api/learn/persona/:id/chat` | 人格对话 |
| POST | `/api/chat/chat` | 通用/人格对话 |
| GET | `/api/chat/conversations` | 会话列表 |
| GET | `/api/chat/conversations/:id` | 会话详情 |
| DELETE | `/api/chat/conversations/:id` | 删除会话 |
| GET | `/api/health` | 健康检查 |
| GET | `/uploads/*` | 静态文件访问 |

---

## 6. 服务层详解

### 6.1 多模态处理 `services/multimodal.ts`

| 函数 | 处理方式 | 输出 |
|------|----------|------|
| `processVideo(filePath, {maxFrames=10})` | ffmpeg 抽帧(640x480) → 逐帧 `analyzeImage` → `summarizeContent` | `content`=帧描述拼接，`summary` |
| `processAudio(filePath)` | OpenAI `whisper-1` 转写 → 总结 | `content`=转写文本 |
| `processImage(filePath)` | Tesseract OCR（`chi_sim+eng`）→ 总结 | `content`=OCR 文本 |
| `processPdf(filePath)` | `pdf-parse` 提取 → 清洗空白 → 总结 | `content`=PDF 文本 |
| `processText(filePath)` | 读文件 → 去 HTML 标签/合并空白 → 总结 | `content`=纯文本 |
| `analyzeImage(imageData, prompt)` | 若 `data:` 前缀先 OCR，否则回退 GPT Vision | 图片文字/描述 |
| `summarizeContent(content, prompt)` | LLM 总结（截断 4000 字） | 摘要 |

统一返回 `ProcessedMaterial { id, content, summary?, metadata }`。

### 6.2 向量存储 `services/vectorStore.ts`

- `QdrantClient`，集合名 `emotion_ai_materials`，向量维度 **1536**（Cosine）。
- `initVectorStore()`：不存在则建集合。
- `addVectors()`：`getEmbedding` 后 `upsert`。
- `searchSimilar(query, limit)`：embedding 检索；失败降级 `simpleSearch`（按单字匹配）。
- `getEmbedding(text)`：OpenAI `text-embedding-3-small`；失败降级 `simpleHashEmbedding`（1536 维字符哈希 + 归一化）。

> Qdrant 需本地启动（默认 `127.0.0.1:6333`）；未启动时所有向量操作自动降级到「关键词匹配 + Hash 向量」，功能可运行但检索质量下降。

### 6.3 人格 Agent `services/personaAgent.ts`

核心类 `PersonaAgent`，实现 **Think → Execute → Reflect** 三段式：

1. **process(input)**：入口。若 `useRag` 且知识图谱非空，调用 `findRelevantKnowledge` 组装 `contextInfo`（检索不到则用全部知识）。
2. **findRelevantKnowledge(query)**：基于分词 + 语义关键词（女性/恋爱/心理/沟通/情感）+ 权重（`keyword.length*2`、`node.weight*20`、特殊加分）打分，取 Top 5。
3. **think()**：LLM 输出思考过程（分析意图/情感/策略）。
4. **execute()**：用「身份 + 知识库 + 规则」系统提示词生成最终回复，规则强调「只输出知识、禁止道德说教」。
5. **reflect()**：反馈 ≥3 条时，LLM 分析洞察与改进建议。
6. `getTemperatureByStyle()`：`humorous=0.9 / gentle=0.6 / rational=0.4 / custom=0.7`。

另导出工厂函数：

| 函数 | 说明 |
|------|------|
| `createPersonaAgent(persona)` | 构造 Agent |
| `generatePersonaFromMaterials(materials, customName?)` | LLM 生成 `name/description/systemPrompt/rules`（JSON 解析失败走兜底默认值），并构建 `knowledgeGraph` |

核心类型：`Persona`、`KnowledgeNode`、`PersonaRule`、`PersonaStats`、`UserFeedback`、`ProcessingContext`、`AgentResponse`、`ThoughtProcess`、`ExecutionResult`、`ReflectionResult`。

### 6.4 通用对话 `services/chat.ts`

- `generateResponse(userMessage, history, {persona, useRag, ragLimit})`：可选 RAG（`searchSimilar` 失败降级 `simpleSearchSimilar`），拼接系统提示词 + 最近 10 条历史 + 用户消息，调用 LLM（`temperature=0.2`）。
- `filterMoralContent(text)`：用 `MORAL_FILTER_PATTERNS` 正则剔除「但是请记住/要尊重/温馨提醒/不要操控」等道德劝诫句式。
- `generatePersonaDescription(materialContents)`：根据资料总结人格特征描述。

---

## 7. 前端详解

### 7.1 入口与路由

- [main.tsx](file:///d:/MyCode/sisterPrj/src/main.tsx)：`createRoot` + `StrictMode` 渲染 `<App/>`。
- [App.tsx](file:///d:/MyCode/sisterPrj/src/App.tsx)：`BrowserRouter`，路由表：

| 路径 | 组件 |
|------|------|
| `/` | Home |
| `/chat`、`/chat/:id` | Chat |
| `/diary`、`/diary/new` | Diary |
| `/learn`、`/learn/upload` | Learn |
| `/settings` | Settings |
| `/profile` | Profile |

### 7.2 状态管理（Zustand + persist）

| Store | localStorage key | 关键状态 |
|-------|------------------|----------|
| `chatStore` | `emotion-ai-chat` | `conversations`、`currentConversationId`、`isLoading` |
| `diaryStore` | `emotion-ai-diary` | `diaries` |
| `learnStore` | `emotion-ai-learn` | `materials`、`personas`、`activePersonaId` |
| `settingsStore` | `emotion-ai-settings` | `apiKey`、`preferences`、`theme` |

### 7.3 页面说明

| 页面 | 功能 |
|------|------|
| `Home` | 功能导航卡片（AI聊天/多模态学习/心情日记/偏好设置/个人中心） |
| `Chat` | 会话列表、消息气泡、人格选择器、RAG 开关、图片上传、发送 |
| `Diary` | 月历视图、心情 emoji 标记、撰写/删除日记 |
| `Learn` | 上传资料、本地文件列表、选择资料创建人格、人格管理（应用/反思/详情） |
| `Settings` | 恋爱状态、兴趣话题、AI 性格、深色模式开关 |
| `Profile` | 账户信息、API Key 设置（仅存本地）、当前设置展示 |

### 7.4 关键交互与数据流

1. **上传**（Learn）：前端检测扩展名 → `POST /api/learn/upload`（`FormData`）→ 成功写入 `learnStore.materials`。
2. **创建人格**（Learn）：勾选已完成的资料 → `POST /api/learn/persona` → 成功后 `addPersona` + `setActivePersona`。
3. **聊天**（Chat）：`POST /api/chat/chat`，携带 `message/conversationId/personaId(activePersonaId)/useRag/image`；返回 `response` 追加为 assistant 消息。
4. **日记**（Diary）：纯前端 `diaryStore`，不经过后端。

---

## 8. 核心数据流

### 阶段一：资料上传与向量化

```
文件 → multer 落盘 uploads/
     → detectFileType 识别 video/audio/image/pdf/text
     → processXxx 提取 content + summary
     → saveMaterials → data/materials.json
     → addVectors → Qdrant（或 Hash 降级）
```

### 阶段二：创建人格

```
勾选资料(completed) → POST /api/learn/persona
  → generatePersonaFromMaterials
     ├─ LLM 生成 name/description/systemPrompt/rules
     └─ 构建 knowledgeGraph (kg-0..n)
  → addPersona → data/personas.json
  → 前端 setActivePersona
```

### 阶段三：RAG 对话

```
POST /api/chat/chat (personaId 存在)
  → POST /api/learn/persona/:id/chat
  → PersonaAgent.process
     ├─ findRelevantKnowledge (检索 Top5 知识)
     ├─ think   (LLM 分析意图/策略)
     └─ execute (LLM 按知识库生成回复，过滤道德说教)
  → 返回 response
```

---

## 9. 数据结构

### Material（学习资料）

```ts
{
  id: string
  title: string
  description: string
  type: 'video' | 'audio' | 'image' | 'pdf' | 'text'
  filePath: string
  status: 'processing' | 'completed'
  summary?: string
  content?: string
  createdAt: Date
}
```

### Persona（人格）

```ts
{
  id: string
  name: string
  description: string
  style: 'gentle' | 'rational' | 'humorous' | 'custom'
  systemPrompt: string
  knowledgeGraph: KnowledgeNode[]
  rules: PersonaRule[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  stats: PersonaStats
  materialIds?: string[]
}
```

### KnowledgeNode（知识节点）

```ts
{
  id: string              // 'kg-0'
  type: 'concept' | 'strategy' | 'example' | 'rule'
  content: string
  sourceMaterialId?: string
  embedding?: number[]
  weight: number
  createdAt: Date
}
```

### PersonaRule / PersonaStats

```ts
// PersonaRule
{ id, name, description, priority, condition?, action }

// PersonaStats
{ totalConversations, successfulInteractions, failedInteractions, feedbackScores[], lastUpdated }
```

---

## 10. 配置与部署

### 10.1 环境变量（`.env`）

| 变量 | 当前值 | 说明 |
|------|--------|------|
| `OPENAI_API_KEY` | `sk-cp-...` | API Key（已配置 Minimax） |
| `OPENAI_BASE_URL` | `https://api.minimaxi.com/v1` | OpenAI 兼容端点 |
| `OPENAI_MODEL` | `MiniMax-M2.7` | 对话/总结模型 |
| `OPENAI_EMBEDDING_MODEL` | 默认 `text-embedding-3-small` | 向量模型（代码默认值） |
| `QDRANT_HOST` / `QDRANT_PORT` | `127.0.0.1` / `6333` | 向量库地址 |
| `PORT` | `3001` | 后端端口 |
| `UPLOAD_DIR` / `MAX_FILE_SIZE` | `./uploads` / `104857600` | 上传目录/大小（代码中硬编码 100MB） |

### 10.2 运行命令（`package.json` scripts）

```bash
npm run dev            # concurrently 同时启动 client(5174) + server(3001)
npm run client:dev     # 仅 Vite
npm run server:dev     # 仅 nodemon (tsx api/server.ts)
npm run build          # tsc -b && vite build
npm run check          # tsc --noEmit
npm run lint           # eslint .
```

### 10.3 部署

- **Vercel**：`vercel.json` 将 `/api/(.*)` rewrite 到 `/api/index`（serverless），其余 rewrite 到 `index.html`（SPA）。
- **本地开发**：Vite 开发服务器代理 `/api` 到 `http://localhost:3001`（见 `vite.config.ts`）。

---

## 11. 已知问题 / 技术债

1. **认证未实现**：`routes/auth.ts` 的 register/login/logout 均为空 TODO，前端 Profile「退出登录」按钮无实际逻辑。
2. **persona 路由重复**：`learn.ts` 与 `persona.ts` 都定义了 `POST /persona`，且都挂在 `/api/learn` 下；实际由先注册的 `learn.ts` 生效，`persona.ts` 的同名处理函数永远不被命中。
3. **服务端相对 URL fetch**：`chat.ts` 中 `fetch('/api/learn/persona/${id}/chat')` 使用相对 URL，Node 原生 `fetch` 不支持相对地址，会抛错并被 catch 捕获，最终回退到 `generateResponse`。因此「指定人格对话」实际可能没有真正走到 `PersonaAgent`。
4. **会话仅存内存**：`chat.ts` 的 `conversations` 为模块级数组，服务重启后丢失，且与前端 `localStorage` 会话状态无同步机制。
5. **向量库强依赖外部服务**：Qdrant 未启动时降级为关键词/Hash 检索，语义检索能力受限。
6. **`.env` 含真实密钥**：已提交明文 API Key，存在泄露风险（`.gitignore` 是否排除需确认）。
7. **未使用代码**：`hooks/useTheme.ts`（页面实际用 `settingsStore.theme`）、`components/Empty.tsx` 未被引用。
8. **README 未更新**：`README.md` 仍是 Vite 模板默认内容，未描述项目。
9. **前端类型不统一**：`learnStore` 的 `LearningMaterial.type` 不含 `'pdf'`（后端支持），`status` 类型与后端 `Material` 也不完全一致。
10. **`saveMaterials` 置空 `filePath`**：序列化后资料丢失文件路径，删除资料时 `fs.unlinkSync` 依赖 `filePath` 会失效。

---

## 12. 快速上手

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量 (修改 .env 中的 API Key / BASE_URL / MODEL)

# 3.（可选）启动 Qdrant 向量库，否则自动降级
# docker run -p 6333:6333 qdrant/qdrant

# 4. 启动前后端
npm run dev
```

访问 `http://localhost:5174`，进入「多模态学习」上传资料 → 勾选资料创建人格 → 在「AI聊天」中选择人格进行 RAG 对话。
