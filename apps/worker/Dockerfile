FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/worker/package*.json ./apps/worker/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared
RUN npm run build -w @sales-ai/shared && npm run build -w @sales-ai/worker

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/vendor ./vendor
CMD ["node", "apps/worker/dist/index.js"]
