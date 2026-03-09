FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm config set fetch-retries 5 \
  && pnpm config set fetch-retry-factor 2 \
  && pnpm config set fetch-retry-maxtimeout 60000 \
  && pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm build
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime

ARG CODEX_CLI_VERSION=0.111.0

WORKDIR /app

ENV NODE_ENV=production
ENV HOME=/root

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    openssh-client \
    procps \
    python3 \
    make \
    g++ \
    ripgrep \
    wget \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g "@openai/codex@${CODEX_CLI_VERSION}"

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY scripts/start-codex-app-server.sh /usr/local/bin/start-codex-app-server
COPY scripts/feishu-bridge.mjs /opt/codex-tools/feishu-bridge.mjs

RUN chmod +x /usr/local/bin/start-codex-app-server

CMD ["node", "dist/index.js"]
