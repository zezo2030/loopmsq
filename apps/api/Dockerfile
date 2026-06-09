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

# ZATCA e-invoicing toolchain: JDK 11 (secp256k1; ZATCA requires >=11 and <15)
# pulled from Temurin's musl build, plus openssl for CSR/key generation.
COPY --from=eclipse-temurin:11-jre-alpine /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
RUN apk add --no-cache openssl

COPY --from=deps /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
# The ZATCA SDK jar (not committed; see zatca-sdk/README.md)
COPY apps/api/zatca-sdk ./zatca-sdk
RUN mkdir -p tmp/zatca

ENV ZATCA_JAVA_BIN=java \
    ZATCA_OPENSSL_BIN=openssl \
    ZATCA_SDK_JAR=/app/apps/api/zatca-sdk/zatca-einvoicing-sdk.jar \
    ZATCA_WORK_DIR=/app/apps/api/tmp/zatca

EXPOSE 3000
CMD ["node", "dist/main.js"]
