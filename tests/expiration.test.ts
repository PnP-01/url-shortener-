import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

const HOUR = 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe('expiração de links', () => {
  it('retorna 410 para link expirado e NÃO conta clique', async () => {
    await prisma.link.create({
      data: {
        code: 'expirado',
        originalUrl: 'https://example.com',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app).get('/expirado').redirects(0);

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('GONE');

    const link = await prisma.link.findUnique({ where: { code: 'expirado' } });
    expect(link?.clickCount).toBe(0);
    expect(link?.lastAccessedAt).toBeNull();
  });

  it('redireciona normalmente enquanto o link não expirou', async () => {
    await prisma.link.create({
      data: {
        code: 'valido',
        originalUrl: 'https://example.com',
        expiresAt: new Date(Date.now() + HOUR),
      },
    });

    const res = await request(app).get('/valido').redirects(0);

    expect(res.status).toBe(302);
  });

  it('link sem data de expiração nunca expira', async () => {
    await prisma.link.create({ data: { code: 'eterno', originalUrl: 'https://example.com' } });

    // Avança o relógio 10 anos. Só o Date é "falsificado"; timers e I/O seguem reais.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 10 * 365 * 24 * HOUR));

    const res = await request(app).get('/eterno').redirects(0);

    expect(res.status).toBe(302);
  });

  it('passa de 302 para 410 quando o tempo avança além da expiração', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    const expiresAt = new Date(Date.now() + HOUR).toISOString();
    const created = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', alias: 'efemero', expiresAt });
    expect(created.status).toBe(201);

    const antes = await request(app).get('/efemero').redirects(0);
    expect(antes.status).toBe(302);

    vi.setSystemTime(new Date(Date.now() + 2 * HOUR));

    const depois = await request(app).get('/efemero').redirects(0);
    expect(depois.status).toBe(410);
  });
});
