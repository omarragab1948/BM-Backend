# Multi-stage Dockerfile for NestJS App

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

# Stage 2: Production Run
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node dist/main"]
