FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false --omit=dev

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=dependencies /app/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
EXPOSE 1511
CMD ["sh", "-c", "npm run db:wait && npm run migrate && npm start"]
