import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';

const router = Router();

// Schedule a new email
router.post('/schedule', EmailController.scheduleEmail);

// Search indexed emails in Elasticsearch
router.get('/search', EmailController.searchEmails);

// Get email record details from DB
router.get('/:id', EmailController.getEmailStatus);

// Inspect BullMQ job status in Redis
router.get('/:id/job', EmailController.getJobStatus);

export default router;
