# ============================================================
# 情感AI伴侣 —— 全栈一体化镜像
# 阶段 1：构建前端 dist
# 阶段 2：安装后端生产依赖
# 阶段 3：运行时（Express 同时托管 API 与静态资源，单端口 3001）
# ============================================================

# ---------- 阶段 1：前端构建 ----------
FROM node:20-alpine AS webbuild
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---------- 阶段 2：后端生产依赖 ----------
FROM node:20-alpine AS serverdeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- 阶段 3：运行时 ----------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=serverdeps /app/node_modules ./node_modules
COPY package.json ./
COPY api ./api
COPY --from=webbuild /app/dist ./dist

# OCR 语言数据（与仓库根目录保持一致布局；缺失时 tesseract 会尝试联网下载）
COPY chi_sim.traineddata eng.traineddata ./

# 数据与上传目录（compose 中以 volume 挂载持久化）
RUN mkdir -p /app/data /app/uploads

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["npx", "tsx", "api/server.ts"]
