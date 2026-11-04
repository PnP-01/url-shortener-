import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('GET /api/links/:code/stats', () => {
  it('retorna total de cliques, data de criação e último acesso', async () => {
    await prisma.link.create({ data: { code: 'estat', originalUrl: 'https://example.com' } });
    await request(app).get('/estat').redirects(0);
    await request(app).get('/estat').redirects(0);

    const res = await request(app).get('/api/links/estat/stats');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('estat');
    expect(res.body.originalUrl).toBe('https://example.com');
    expect(res.body.totalClicks).toBe(2);
    expect(new Date(res.body.createdAt).getTime()).not.toBeNaN();
    expect(new Date(res.body.lastAccessedAt).getTime()).not.toBeNaN();
  });

  it('link sem acessos tem 0 cliques e lastAccessedAt nulo', async () => {
    await prisma.link.create({ data: { code: 'virgem', originalUrl: 'https://example.com' } });

    const res = await request(app).get('/api/links/virgem/stats');

    expect(res.status).toBe(200);
    expect(res.body.totalClicks).toBe(0);
    expect(res.body.lastAccessedAt).toBeNull();
  });

  it('continua disponível para links expirados', async () => {
    await prisma.link.create({
      data: {
        code: 'velho',
        originalUrl: 'https://example.com',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app).get('/api/links/velho/stats');

    expect(res.status).toBe(200);
  });

  it('retorna 404 quando o link não existe', async () => {
    const res = await request(app).get('/api/links/nao-existe/stats');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/links/:code', () => {
  it('remove o link e responde 204 sem corpo', async () => {
    await prisma.link.create({ data: { code: 'apagar', originalUrl: 'https://example.com' } });

    const res = await request(app).delete('/api/links/apagar');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await prisma.link.findUnique({ where: { code: 'apagar' } })).toBeNull();
  });

  it('depois de removido, o link curto passa a retornar 404', async () => {
    await prisma.link.create({ data: { code: 'sumiu', originalUrl: 'https://example.com' } });
    await request(app).delete('/api/links/sumiu');

    const res = await request(app).get('/sumiu').redirects(0);

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao remover um link que não existe (ou já foi removido)', async () => {
    await prisma.link.create({ data: { code: 'uma-vez', originalUrl: 'https://example.com' } });

    const primeira = await request(app).delete('/api/links/uma-vez');
    const segunda = await request(app).delete('/api/links/uma-vez');

    expect(primeira.status).toBe(204);
    expect(segunda.status).toBe(404);
    expect(segunda.body.error.code).toBe('NOT_FOUND');
  });
});
