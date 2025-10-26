# API (NestJS) Dockerfile for Monorepo
FROM node:20 AS deps
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm install --no-audit --no-fund

FROM node:20 AS build
WORKDIR /app
COPY . .
COPY --from=deps /app/apps/api/node_modules /app/apps/api/node_modules
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=deps /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
