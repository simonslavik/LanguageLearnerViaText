# ── Frontend — React/Vite build → Nginx ─────────────────────────────────────

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Google client ID is injected at build time so it ends up in the JS bundle
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

RUN npm run build

# ── Stage 2: serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Replace default config with our SPA + API-proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the Vite build output
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
