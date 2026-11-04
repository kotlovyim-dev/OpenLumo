FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/providers/package.json packages/providers/
RUN pnpm install --frozen-lockfile --filter "@openlumo/worker..."
COPY packages packages
COPY apps/worker apps/worker

FROM node:24-slim
ENV NODE_ENV=production
COPY --from=build /app /app
RUN mkdir -p /data/assets && chown node:node /data/assets
USER node
WORKDIR /app/apps/worker
CMD ["node_modules/.bin/tsx", "src/main.ts"]
