FROM node:22-bookworm-slim

# The active backend is PostgreSQL-backed and does not run a WhatsApp browser
# inside the serverless deployment. WhatsApp remains disabled by default.
ENV NODE_ENV=production
ENV WHATSAPP_ENABLED=false

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build && npm prune --omit=dev

EXPOSE 4000

CMD ["node", "dist/index.js"]
