import { Router } from 'express';
import { linkRouter } from './link.routes';

export const apiRouter = Router();

apiRouter.use('/links', linkRouter);
