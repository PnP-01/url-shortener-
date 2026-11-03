import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, NotFoundError, ValidationError } from '../errors/app-error';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Rota ${req.method} ${req.path} não encontrada`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // JSON malformado no corpo da requisição (erro do body parser)
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    err.type === 'entity.parse.failed'
  ) {
    err = new ValidationError('JSON malformado');
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } });
};
