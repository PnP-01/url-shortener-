import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Todos os arquivos de teste compartilham o mesmo banco SQLite;
    // rodar um por vez evita interferência e erros de "database is locked".
    fileParallelism: false,
    // Estas variáveis têm prioridade sobre o .env (o dotenv não sobrescreve o que já existe).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      BASE_URL: 'http://localhost:3000',
      RATE_LIMIT_MAX: '1000',
    },
  },
});
