import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

// Roda UMA vez antes de todos os testes: recria o banco de teste do zero
// aplicando as migrations reais do projeto (prisma/migrations).
export default function setup(): void {
  // 'file:./test.db' é relativo à pasta do schema, ou seja, prisma/test.db
  const dbFile = path.resolve(process.cwd(), 'prisma', 'test.db');
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });

  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
