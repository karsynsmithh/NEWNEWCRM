FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /data/uploads

ENV NODE_ENV=production
ENV DB_PATH=/data/cre_dashboard.db
ENV UPLOADS_PATH=/data/uploads
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "server.js"]
