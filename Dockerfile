# ---------- Estágio 1: build ----------
# Instala todas as dependências, gera o Prisma Client e compila o TypeScript.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# O Prisma precisa do OpenSSL, que não vem na imagem "slim".
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build


# ---------- Estágio 2: runtime ----------
# Imagem final: só dependências de produção + código compilado.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="file:/data/shortener.db"

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir /data && chown node:node /data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# Roda como usuário sem privilégios; o banco SQLite fica no volume /data.
USER node
EXPOSE 3000
VOLUME /data

# Aplica as migrations pendentes e sobe o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
