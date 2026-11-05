import path from 'node:path';
import express from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { apiRouter } from './routes';
import { redirectRouter } from './routes/redirect.routes';

export const app = express();

app.use(express.json({ limit: '10kb' }));

// Interface web (HTML/CSS/JS puros em /public). Vem antes de /:code para que "/" abra a página.
// Os nomes dos arquivos têm ponto (app.js, styles.css) e aliases não aceitam ponto: sem conflito.
app.use(express.static(path.resolve(process.cwd(), 'public')));

app.use('/api', apiRouter);
app.use(redirectRouter); // /:code fica DEPOIS de /api, para o /api ter prioridade

app.use(notFoundHandler); // depois de todas as rotas
app.use(errorHandler); // sempre por último
