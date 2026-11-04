import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';

// Trava de segurança: os testes apagam dados, então nunca podem rodar no banco de desenvolvimento.
const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl.includes('test')) {
  throw new Error(`Os testes só podem rodar no banco de teste. DATABASE_URL atual: ${databaseUrl}`);
}

// Cada teste começa com a tabela vazia.
beforeEach(async () => {
  await prisma.link.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
