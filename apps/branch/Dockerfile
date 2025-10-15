# Branch React (Vite) Dockerfile
FROM node:20 AS deps
WORKDIR /app/apps/branch
COPY apps/branch/package*.json ./
# استخدم npm install بدلاً من npm ci بسبب عدم تزامن package-lock
RUN npm install --legacy-peer-deps

FROM node:20 AS build
WORKDIR /app
COPY . .
COPY --from=deps /app/apps/branch/node_modules /app/apps/branch/node_modules
WORKDIR /app/apps/branch
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /usr/share/nginx/html
RUN apk add --no-cache nginx
COPY --from=build /app/apps/branch/dist .
COPY apps/branch/nginx.conf /etc/nginx/http.d/default.conf
RUN mkdir -p /run/nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]



