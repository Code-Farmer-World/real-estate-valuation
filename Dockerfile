# syntax=docker/dockerfile:1.4
#
# 前端靜態站鏡像（Vite build → nginx）。
#
# 後端是另一個 repo（../real-estate-valuation-py），各自獨立部署、只透過 HTTP
# 溝通，所以不放進同一個 compose。API 位址在 build 當下就烤進 bundle，
# 來源是 .env.${BUILD_MODE}，見 .env.production。


# ---------- base ----------
# 版本需滿足 package.json 的 engines：^22.18.0 || >=24.12.0
FROM node:24.16.0-slim AS base

WORKDIR /app

# 決定 vite build --mode，連帶決定載入哪一個 .env 檔
ARG BUILD_MODE=production
ENV BUILD_MODE=${BUILD_MODE}


# ---------- deps：只負責裝套件 ----------
# 單獨切一層，改原始碼時這層仍然命中快取；npm 快取用 BuildKit 掛載，
# 跨次 build 重用已下載的套件。
FROM base AS deps

COPY package*.json ./

# 這裡刻意不設 NODE_ENV=production：vite 在 devDependencies，
# 設了就會被跳過，下一階段會找不到 vite。
RUN --mount=type=cache,target=/root/.npm \
    npm ci


# ---------- build ----------
FROM deps AS build-stage

COPY . .

# 用 npx vite build 而不是 npm run build：後者的 run-p 會一併跑 vue-tsc 型別檢查，
# 那是 CI 該擋的事，鏡像裡再跑一次只是拖慢 build。
RUN npx vite build --mode ${BUILD_MODE}


# ---------- production：nginx 送靜態檔 ----------
# 最終鏡像只有靜態檔 + nginx，不帶 node_modules 和原始碼。
FROM nginx:alpine AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html

# SPA 的路由 fallback 靠這份設定，少了它重新整理會 404，細節見 nginx.conf。
# 從 build context 複製而不是從 build-stage：改 nginx.conf 就不必重跑 npm 和 vite。
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# -g "daemon off;"：前景執行，容器才不會啟動完就退出。
CMD ["nginx", "-g", "daemon off;"]


# =============================================================================
# 建構與執行：
#
#   docker build -t real-estate-valuation-frontend .
#   docker run -d --name real-estate-valuation-frontend -p 2180:80 real-estate-valuation-frontend
#
# 平常用 docker compose 就好，見 docker-compose.yml。
# =============================================================================
