FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-api/package.json ./packages/shared-api/
COPY apps/backend/package.json ./apps/backend/

RUN npm install --workspace=@todo-platform/backend --include-workspace-root

COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/
COPY tsconfig.base.json ./

RUN npm run build --workspace=@todo-platform/shared-types
RUN npm run build --workspace=@todo-platform/shared-api
RUN npm run prisma:generate --workspace=@todo-platform/backend
RUN npm run build --workspace=@todo-platform/backend

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-api/package.json ./packages/shared-api/
COPY apps/backend/package.json ./apps/backend/

RUN npm install --workspace=@todo-platform/backend --include-workspace-root --omit=dev

COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-api/dist ./packages/shared-api/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

WORKDIR /app/apps/backend

ENV RUN_MIGRATIONS=true
EXPOSE 3000

CMD ["node", "dist/main.js"]
