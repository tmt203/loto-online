# ---------- BUILD STAGE ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build app (vite + esbuild)
RUN npm run build


# ---------- RUNTIME STAGE ----------
FROM node:20-alpine

WORKDIR /app

# Chỉ copy những thứ cần thiết
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.js ./server.js

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "server.js"]