FROM node:20-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY src/ ./src/
COPY public/ ./public/
COPY bgm1.mp3 ./bgm1.mp3

RUN mkdir -p /app/data && \
    addgroup -S app && \
    adduser -S app -G app && \
    chown -R app:app /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
