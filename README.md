# 情感AI伴侣

上传聊天截图 → 识别 IOI/IOD 信号 → 规则引擎决策（进攻 / 观察 / 退守）→ 调用九术知识库生成候选话术的 AI 情感辅助应用。

定位为 **Web App**：浏览器打开即用，iPhone「添加到主屏幕」后拥有近似原生 App 的体验，无需应用商店分发。

## 核心流程

```
聊天截图 → 识图解析 → 人格侧写 → 阶段判定 → IOI/IOD 信号识别
        → 规则引擎策略决策（感知与决策分离，决策可解释、可回归）
        → 九术知识库匹配（强制溯源）→ 候选话术生成 → 用户反馈回流
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand（persist） |
| 后端 | Express + multer + tsx |
| AI | OpenAI 兼容协议（当前 Minimax）；多模态：tesseract OCR / Whisper / ffmpeg |
| 检索 | Qdrant 向量库（未启动时自动降级关键词检索） |
| 规则引擎 | 外置 `api/data/rules.yaml`（可热更新） |
| 鉴权 | 手机号 + 验证码（HMAC 签名 token，零依赖） |

## 本地运行

```bash
npm install
cp .env.example .env        # 填入 OPENAI_API_KEY 等配置
npm run dev                 # 前端 http://localhost:5174（/api 代理到 3001）
```

可选：启动本地 Qdrant 向量库（`docker run -p 6333:6333 qdrant/qdrant`），不启动则自动降级。

## 手机局域网调试（同一 WiFi）

```bash
npm run dev:lan             # Vite 监听所有网卡
```

手机浏览器打开 `http://<电脑局域网IP>:5174`，功能与桌面完全一致（上传截图、登录、分析）。

## 生产部署（Docker）

```bash
docker compose up -d --build        # 单容器：前端静态 + API，端口 80
docker compose logs -f app
```

有域名后启用自动 HTTPS：`cp deploy/Caddyfile.example deploy/Caddyfile` 填入域名，然后 `docker compose --profile tls up -d`。

## 环境变量

见 [.env.example](.env.example)。生产必须设置 `AUTH_SECRET` 为随机长字符串；
`MOCK_LLM=true` 时分析引擎不调用真实 LLM（演示/测试用）；
`SMS_PROVIDER=mock` 时验证码直接显示在页面上（联调用，生产接真实短信服务商）。

## 目录结构

```
api/                  后端
  data/rules.yaml     回复思路规则（策略决策核心资产）
  middleware/auth.ts  鉴权中间件
  routes/             auth / analyze / chat / learn+persona
  services/analysis/  七步分析流水线
  services/rules/     规则引擎
  services/auth/      验证码 + 签名 token
src/                  前端（pages/ stores/ components/ lib/）
public/icons/         应用图标（scripts/make-icons.mjs 重新生成）
deploy/               Caddyfile 示例（HTTPS）
harmonyos-shell/      鸿蒙 ArkTS WebView 壳 starter（备用路线）
```

## 备注

- 原生壳路线（Capacitor）工程仍在 `android/`、`ios/`，需要时可用 `npm run cap:sync` 恢复维护；
- 多用户生产化待办：PostgreSQL 替换 JSON 文件、对象存储替换本地 uploads、真实短信服务商。
