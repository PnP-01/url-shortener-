import type { Link } from '@prisma/client';
import { AppError, ConflictError, GoneError, NotFoundError } from '../errors/app-error';
import { linkRepository } from '../repositories/link.repository';
import type { CreateLinkInput } from '../schemas/link.schema';
import { generateCode } from '../utils/code-generator';

const CODE_LENGTH = 7;
const MAX_CODE_ATTEMPTS = 5;

export const linkService = {
  async create(input: CreateLinkInput): Promise<Link> {
    const base = { originalUrl: input.url, expiresAt: input.expiresAt ?? null };

    // Alias personalizado: se já existe, o erro é do usuário (409).
    if (input.alias) {
      const link = await linkRepository.create({ ...base, code: input.alias });
      if (!link) throw new ConflictError(`O alias "${input.alias}" já está em uso`);
      return link;
    }

    // Código gerado: se colidir, o erro não é do usuário, então sorteamos outro.
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const link = await linkRepository.create({ ...base, code: generateCode(CODE_LENGTH) });
      if (link) return link;
    }

    throw new AppError(500, 'CODE_GENERATION_FAILED', 'Não foi possível gerar um código único');
  },

  /** Devolve a URL original e registra o clique. Lança 404 ou 410 quando aplicável. */
  async resolve(code: string): Promise<string> {
    const link = await linkRepository.findByCode(code);

    if (!link) throw new NotFoundError('Link não encontrado');

    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new GoneError('Este link expirou');
    }

    await linkRepository.registerClick(code);
    return link.originalUrl;
  },

  /** Estatísticas continuam disponíveis mesmo depois de o link expirar. */
  async getStats(code: string): Promise<Link> {
    const link = await linkRepository.findByCode(code);
    if (!link) throw new NotFoundError('Link não encontrado');
    return link;
  },

  async remove(code: string): Promise<void> {
    const deleted = await linkRepository.deleteByCode(code);
    if (!deleted) throw new NotFoundError('Link não encontrado');
  },
};
