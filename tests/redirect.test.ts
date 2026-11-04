import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('GET /:code', () => {
  it('redireciona com 302 para a URL original', async () => {
    await prisma.link.create({
      data: { code: 'abc1234', originalUrl: 'https://example.com/destino' },
    });

    const res = await request(app).get('/abc1234').redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/destino');
  });

  it('registra um clique a cada acesso', async () => {
    await prisma.link.create({ data: { code: 'cliques', originalUrl: 'https://example.com' } });

    await request(app).get('/cliques').redirects(0);
    await request(app).get('/cliques').redirects(0);
    await request(app).get('/cliques').redirects(0);

    const link = await prisma.link.findUnique({ where: { code: 'cliques' } });
    expect(link?.clickCount).toBe(3);
    expect(link?.lastAccessedAt).toBeInstanceOf(Date);
  });

  it('retorna 404 em JSON quando o código não existe', async () => {
    const res = await request(app).get('/nao-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('funciona de ponta a ponta: cria pela API e acessa o link curto', async () => {
    const created = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com/e2e', alias: 'ponta-a-ponta' });

    const res = await request(app).get(`/${created.body.code}`).redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/e2e');
  });
});
