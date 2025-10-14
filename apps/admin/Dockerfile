# Admin React (Vite) Dockerfile
FROM node:20 AS deps
WORKDIR /app/apps/admin
COPY apps/admin/package*.json ./
RUN npm ci

FROM node:20 AS build
WORKDIR /app
COPY . .
COPY --from=deps /app/apps/admin/node_modules /app/apps/admin/node_modules
WORKDIR /app/apps/admin
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /usr/share/nginx/html
RUN apk add --no-cache nginx
COPY --from=build /app/apps/admin/dist .
COPY apps/admin/nginx.conf /etc/nginx/http.d/default.conf
RUN mkdir -p /run/nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
