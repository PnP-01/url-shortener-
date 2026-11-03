import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { apiRouter } from './routes';
import { redirectRouter } from './routes/redirect.routes';

export const app = express();

app.use(express.json({ limit: '10kb' }));

app.use('/api', apiRouter);
app.use(redirectRouter); // /:code fica DEPOIS de /api, para o /api ter prioridade

app.use(notFoundHandler); // depois de todas as rotas
app.use(errorHandler); // sempre por último
