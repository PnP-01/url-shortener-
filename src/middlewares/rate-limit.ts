import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';

export const createLinkRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // delega ao error handler central, para o 429 sair no mesmo formato JSON
  handler: (_req, _res, next) =>
    next(new AppError(429, 'RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.')),
});
