import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// O limite é lido do ambiente quando o módulo carrega. Por isso mudamos a variável,
// descartamos o cache de módulos e importamos o app de novo, com um limiter novo (e contador zerado).
describe('rate limit em POST /api/links', () => {
  beforeEach(() => {
    vi.stubEnv('RATE_LIMIT_MAX', '2');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('retorna 429 em JSON depois de exceder o limite', async () => {
    const { app } = await import('../src/app.js');
    const send = () => request(app).post('/api/links').send({ url: 'https://example.com' });

    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);

    const bloqueada = await send();
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.error.code).toBe('RATE_LIMITED');
  });

  it('requisições inválidas também contam no limite', async () => {
    const { app } = await import('../src/app.js');
    const invalida = () => request(app).post('/api/links').send({ url: 'nao-e-url' });

    expect((await invalida()).status).toBe(400);
    expect((await invalida()).status).toBe(400);
    expect((await invalida()).status).toBe(429);
  });
});
