import { Prisma, type Link } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type CreateLinkData = {
  code: string;
  originalUrl: string;
  expiresAt: Date | null;
};

export const linkRepository = {
  /** Retorna o link criado, ou null se o código já estiver em uso. */
  async create(data: CreateLinkData): Promise<Link | null> {
    try {
      return await prisma.link.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  },

  findByCode(code: string): Promise<Link | null> {
    return prisma.link.findUnique({ where: { code } });
  },

  async registerClick(code: string): Promise<void> {
    await prisma.link.updateMany({
      where: { code },
      data: { clickCount: { increment: 1 }, lastAccessedAt: new Date() },
    });
  },
};
