import type { Link } from '@prisma/client';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import type { CreateLinkInput } from '../schemas/link.schema';
import { linkService } from '../services/link.service';

function toLinkResponse(link: Link) {
  return {
    code: link.code,
    shortUrl: `${env.BASE_URL}/${link.code}`,
    originalUrl: link.originalUrl,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
  };
}

export const linkController = {
  async create(req: Request, res: Response) {
    const input: CreateLinkInput = req.body; // req.body é `any`; o validateBody já garantiu o formato
    const link = await linkService.create(input);
    res.status(201).json(toLinkResponse(link));
  },

  async redirect(req: Request<{ code: string }>, res: Response) {
    const originalUrl = await linkService.resolve(req.params.code);
    res.redirect(302, originalUrl);
  },
};
