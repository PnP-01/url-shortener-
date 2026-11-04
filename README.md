# URL Shortener

API REST de encurtamento de URLs construída com **Node.js, TypeScript (strict), Express 5, Prisma e SQLite**.
Projeto de portfólio com foco em arquitetura em camadas, tratamento de erros centralizado, validação de entrada
e testes de integração.

## Funcionalidades

- Encurta URLs `http`/`https` e devolve um código curto de 7 caracteres base62.
- **Alias personalizado** (ex.: `/meu-link`), com verificação de conflito.
- **Data de expiração** opcional: depois dela, o link responde `410 Gone`.
- Redirecionamento `302` com **contagem de cliques** e registro do último acesso.
- **Estatísticas** por link e **remoção** de links.
- **Rate limiting** no endpoint de criação.
- Respostas de erro JSON padronizadas.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime / linguagem | Node.js + TypeScript (`strict`) |
| HTTP | Express 5 |
| Banco / ORM | SQLite + Prisma 6 |
| Validação | Zod |
| Rate limit | express-rate-limit |
| Testes | Vitest + Supertest |
| Qualidade | ESLint + Prettier |
| Deploy | Docker (multi-stage) |

## Como rodar localmente

Requisitos: **Node.js 22+** (recomendado) e npm.

```bash
git clone https://github.com/PnP-01/url-shortener-
cd url-shortener
npm install

cp .env.example .env              # no PowerShell: Copy-Item .env.example .env
npx prisma migrate dev            # cria o banco SQLite e gera o Prisma Client

npm run dev                       # http://localhost:3000
```

### Variáveis de ambiente

Definidas em `.env` (modelo em `.env.example`) e validadas com Zod na inicialização: se alguma estiver inválida, o app não sobe.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `PORT` | `3000` | Porta HTTP |
| `BASE_URL` | `http://localhost:3000` | Usada para montar o campo `shortUrl` das respostas |
| `DATABASE_URL` | — (obrigatória) | Ex.: `file:./dev.db` (relativo à pasta `prisma/`) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Janela do rate limit, em ms |
| `RATE_LIMIT_MAX` | `10` | Máximo de criações de link por IP por janela |

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor com recarga automática (`tsx watch`) |
| `npm run build` | Compila para `dist/` |
| `npm start` | Roda a versão compilada |
| `npm test` | Roda os testes de integração |
| `npm run typecheck` | Checa os tipos (código e testes) |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Como rodar com Docker

```bash
docker compose up --build
```

A API fica em `http://localhost:3000`. As migrations são aplicadas automaticamente na inicialização, e o banco
SQLite fica no volume `link-data` (os dados sobrevivem a reinícios do container).

Sem o Compose:

```bash
docker build -t url-shortener .
docker run -p 3000:3000 -v link-data:/data -e BASE_URL=http://localhost:3000 url-shortener
```

## Referência da API

> Os exemplos usam `curl` em shell estilo bash. No **PowerShell** use `curl.exe` e escape as aspas do JSON:
> `-d '{\"url\":\"https://github.com\"}'`.

### `POST /api/links` — criar link

Corpo:

| Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- |
| `url` | string | sim | `http` ou `https` válida, até 2048 caracteres |
| `alias` | string | não | 3 a 30 caracteres: letras, números, `_` ou `-` (alguns nomes são reservados, como `api`) |
| `expiresAt` | string | não | Data ISO 8601 no futuro, ex.: `2030-01-01T00:00:00Z` |

```bash
curl -i -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://github.com","alias":"meu-link","expiresAt":"2030-01-01T00:00:00Z"}'
```

`201 Created`:

```json
{
  "code": "meu-link",
  "shortUrl": "http://localhost:3000/meu-link",
  "originalUrl": "https://github.com",
  "createdAt": "2026-11-04T12:00:00.000Z",
  "expiresAt": "2030-01-01T00:00:00.000Z"
}
```

Sem `alias`, o código é gerado automaticamente (ex.: `k3Zq9Ab`).

Erros: `400` (validação), `409` (alias já em uso), `429` (rate limit).

### `GET /:code` — redirecionar

```bash
curl -i http://localhost:3000/meu-link
```

- `302 Found` com o header `Location` apontando para a URL original (e +1 clique registrado)
- `404 Not Found` se o código não existe
- `410 Gone` se o link expirou (nenhum clique é contado)

### `GET /api/links/:code/stats` — estatísticas

```bash
curl http://localhost:3000/api/links/meu-link/stats
```

`200 OK`:

```json
{
  "code": "meu-link",
  "originalUrl": "https://github.com",
  "totalClicks": 3,
  "createdAt": "2026-11-04T12:00:00.000Z",
  "lastAccessedAt": "2026-11-04T12:05:31.200Z",
  "expiresAt": "2030-01-01T00:00:00.000Z"
}
```

As estatísticas continuam disponíveis mesmo depois de o link expirar. `404` se o link não existe.

### `DELETE /api/links/:code` — remover

```bash
curl -i -X DELETE http://localhost:3000/api/links/meu-link
```

`204 No Content` em caso de sucesso, `404` se o link não existe.

### Formato dos erros

Todas as falhas seguem o mesmo formato:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados de entrada inválidos",
    "details": [{ "field": "url", "message": "Informe uma URL http ou https válida" }]
  }
}
```

Códigos usados: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFLICT` (409), `GONE` (410),
`RATE_LIMITED` (429) e `INTERNAL_ERROR` (500). Erros inesperados nunca expõem a mensagem original ao cliente.

## Testes

```bash
npm test
```

Testes de integração com Vitest + Supertest, cobrindo criação, redirecionamento, expiração, estatísticas, remoção
e rate limit. Pontos de projeto:

- Usam um **banco separado** (`prisma/test.db`), recriado a cada execução com as migrations reais do projeto.
  Uma trava impede que os testes rodem contra o banco de desenvolvimento.
- A expiração é testada **avançando o relógio** (`vi.useFakeTimers` só para `Date`), sem `sleep`.
- O rate limit é testado reimportando o app com um limite menor (`vi.stubEnv` + `vi.resetModules`).

## Estrutura do projeto

```
prisma/              schema e migrations
src/
  config/            leitura e validação do .env
  routes/            definição das rotas
  controllers/       camada HTTP: lê a requisição e monta a resposta
  services/          regras de negócio (colisão, expiração, 404/410)
  repositories/      único ponto de acesso ao Prisma
  schemas/           schemas Zod de entrada
  middlewares/       validação, rate limit e tratamento de erros
  errors/            AppError e subclasses
  utils/             gerador de código base62
  app.ts             monta o app Express (sem abrir porta)
  server.ts          sobe o servidor
tests/               testes de integração
```

O fluxo é `route → controller → service → repository`. Separar `app.ts` de `server.ts` permite que o Supertest
use o app sem abrir uma porta de verdade.

## Decisões técnicas

- **Express 5.** Rejeições de funções `async` chegam ao error handler sem `try/catch` nos controllers. Fastify foi
  considerado (mais rápido, validação embutida), mas o Express é o mais conhecido e o gargalo aqui não é performance.
- **Prisma 6 fixado.** Dá migrations versionadas e tipos gerados a partir do schema. O Prisma 7 mudou a configuração
  de conexão (adapters para SQLite), então a versão 6 foi mantida de propósito.
- **Colisão de códigos tratada no banco.** Em vez de "checar se existe e depois inserir" (sujeito a condição de
  corrida), o service tenta inserir e deixa a constraint `UNIQUE` decidir. Para códigos gerados, uma colisão gera nova
  tentativa (até 5). Para aliases, vira `409`.
- **Códigos aleatórios com `crypto.randomInt`.** 7 caracteres base62 (~3,5 trilhões de combinações), criptograficamente
  seguros e imprevisíveis. Converter o `id` autoincrementado para base62 seria mais simples, mas geraria links
  sequenciais e fáceis de enumerar.
- **`302` em vez de `301`.** O `301` é cacheado pelo navegador: cliques deixariam de ser contados e um link expirado
  continuaria funcionando para quem já o visitou.
- **Só `http`/`https` são aceitos.** `new URL("javascript:alert(1)")` é um URL válido para o parser, então checar apenas
  "é parseável" criaria um vetor de XSS.
- **Contadores na própria tabela.** `clickCount` e `lastAccessedAt` atendem aos requisitos com uma única tabela e um
  `UPDATE` atômico (`increment`), sem ler e regravar.
- **Rate limit antes da validação.** Requisições inválidas também contam no limite.
- **Erros como dados.** `AppError` carrega status HTTP e código estável; um único middleware converte tudo para o
  formato JSON padrão.
- **Configuração validada no boot.** O `.env` é parseado com Zod; configuração inválida derruba o app imediatamente
  (*fail fast*).

## Limitações conhecidas e melhorias futuras

- **Sem autenticação.** Qualquer pessoa pode consultar as estatísticas ou remover qualquer link. Próximo passo natural:
  contas de usuário (ou API keys) com cada link pertencendo a um dono.
- **Rate limit em memória, por IP.** Não é compartilhado entre várias instâncias (usar Redis nesse caso). Atrás de um
  proxy reverso é preciso configurar `trust proxy`, senão todos os usuários aparecem com o IP do proxy.
- **Analytics mais ricos.** Trocar os contadores por uma tabela `Click` (data, referrer, user-agent, país) permitiria
  gráficos e filtros por período.
- **Proteção contra abuso.** Verificar URLs contra listas de phishing/malware (ex.: Google Safe Browsing) e bloquear
  domínios próprios.
- **Limpeza de links expirados** com um job agendado.
- **Listagem paginada** (`GET /api/links`) e edição de links.
- **Banco de dados.** Migrar de SQLite para PostgreSQL ao escalar (o Prisma facilita a troca).
- **Observabilidade.** Logs estruturados (pino), endpoint `/health` e métricas.
- **Documentação interativa** com OpenAPI/Swagger e **CI** com GitHub Actions (lint, typecheck e testes a cada push).
- **Aliases case-insensitive**, se esse comportamento for desejado.
