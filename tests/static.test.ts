import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('interface web', () => {
  it('serve a página inicial em GET /', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Cole um link longo');
  });

  it('serve o JavaScript e o CSS da página', async () => {
    const js = await request(app).get('/app.js');
    const css = await request(app).get('/styles.css');

    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toMatch(/javascript/);
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/text\/css/);
  });

  it('continua devolvendo 404 em JSON para rotas desconhecidas', async () => {
    const res = await request(app).get('/api/nada-por-aqui');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
