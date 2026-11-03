import { Router } from 'express';
import { linkController } from '../controllers/link.controller';

export const redirectRouter = Router();

redirectRouter.get('/:code', linkController.redirect);
