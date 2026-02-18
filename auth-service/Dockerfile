FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.cjs ./

EXPOSE 3847

# Запуск напрямую через node — без npm (избегаем SIGTERM)
CMD ["node", "index.cjs"]
