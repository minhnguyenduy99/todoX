FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-api/package.json ./packages/shared-api/
COPY apps/mcp-server/package.json ./apps/mcp-server/

RUN npm install --workspace=@todo-platform/mcp-server --include-workspace-root

COPY packages/ ./packages/
COPY apps/mcp-server/ ./apps/mcp-server/
COPY tsconfig.base.json ./

RUN npm run build --workspace=@todo-platform/shared-types
RUN npm run build --workspace=@todo-platform/shared-api
RUN npm run build --workspace=@todo-platform/mcp-server

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-api/package.json ./packages/shared-api/
COPY apps/mcp-server/package.json ./apps/mcp-server/

RUN npm install --workspace=@todo-platform/mcp-server --include-workspace-root --omit=dev

COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-api/dist ./packages/shared-api/dist
COPY --from=builder /app/apps/mcp-server/dist ./apps/mcp-server/dist

WORKDIR /app/apps/mcp-server

ENV MCP_TRANSPORT=http
EXPOSE 3001

CMD ["node", "dist/index.js"]
