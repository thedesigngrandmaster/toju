FROM node:22-bookworm-slim

# Chromium is required by whatsapp-web.js (Puppeteer). The API still starts and
# keeps messages queued when WHATSAPP_ENABLED is false.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV WHATSAPP_ENABLED=true
ENV WHATSAPP_CHROME_PATH=/usr/bin/chromium
ENV WHATSAPP_AUTH_PATH=/app/.wwebjs_auth

WORKDIR /app

# Dependencies are installed with npm (the project is an npm workspace).
COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build && npm prune --omit=dev

EXPOSE 4000

CMD ["node", "dist/index.js"]
