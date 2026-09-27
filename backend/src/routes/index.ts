import { Router } from 'express';
import emailRoutes from './email.routes';

const router = Router();

router.use('/emails', emailRoutes);

export default router;
