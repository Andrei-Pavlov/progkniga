FROM node:20-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.cjs webAuth.cjs mail.cjs ./
COPY --from=web /web/dist ./public
EXPOSE 3847
CMD ["node", "index.cjs"]
