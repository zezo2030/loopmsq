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

FROM nginx:alpine AS prod
WORKDIR /usr/share/nginx/html
COPY --from=build /app/apps/admin/dist .
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
