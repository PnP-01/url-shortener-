import { Router } from 'express';
import { linkController } from '../controllers/link.controller';
import { createLinkRateLimiter } from '../middlewares/rate-limit';
import { validateBody } from '../middlewares/validate';
import { createLinkSchema } from '../schemas/link.schema';

export const linkRouter = Router();

// O rate limit vem ANTES da validação: requisições inválidas também contam no limite.
linkRouter.post('/', createLinkRateLimiter, validateBody(createLinkSchema), linkController.create);
