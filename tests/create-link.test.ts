import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

const createLink = (body: object) => request(app).post('/api/links').send(body);

describe('POST /api/links', () => {
  it('cria um link com código gerado de 7 caracteres base62', async () => {
    const res = await createLink({ url: 'https://example.com/pagina' });

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(res.body.shortUrl).toBe(`http://localhost:3000/${res.body.code}`);
    expect(res.body.originalUrl).toBe('https://example.com/pagina');
    expect(res.body.expiresAt).toBeNull();
  });

  it('aceita alias personalizado e data de expiração', async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await createLink({ url: 'https://example.com', alias: 'meu-link', expiresAt });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('meu-link');
    expect(res.body.shortUrl).toBe('http://localhost:3000/meu-link');
    expect(res.body.expiresAt).toBe(expiresAt);
  });

  it('retorna 409 quando o alias já está em uso', async () => {
    await createLink({ url: 'https://example.com/a', alias: 'repetido' });

    const res = await createLink({ url: 'https://example.com/b', alias: 'repetido' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it.each(['javascript:alert(1)', 'ftp://example.com/arquivo', 'isso não é uma url', ''])(
    'rejeita URL inválida ou que não seja http/https: "%s"',
    async (url) => {
      const res = await createLink({ url });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it.each(['ab', 'com espaço', 'api', 'API'])('rejeita alias inválido ou reservado: "%s"', async (alias) => {
    const res = await createLink({ url: 'https://example.com', alias });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['no passado', () => new Date(Date.now() - 60_000).toISOString()],
    ['em formato inválido', () => '31/12/2030'],
  ])('rejeita expiresAt %s', async (_nome, gerar) => {
    const res = await createLink({ url: 'https://example.com', expiresAt: gerar() });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejeita corpo vazio', async () => {
    const res = await createLink({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejeita JSON malformado', async () => {
    const res = await request(app)
      .post('/api/links')
      .set('Content-Type', 'application/json')
      .send('{"url":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
