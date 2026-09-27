import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';

const router = Router();

// List emails with pagination and status filtering
router.get('/', EmailController.listEmails);

// Schedule a new single email
router.post('/schedule', EmailController.scheduleEmail);

// Bulk schedule multiple emails
router.post('/bulk-schedule', EmailController.bulkSchedule);

// Search indexed emails in Elasticsearch
router.get('/search', EmailController.searchEmails);

// Get email record details from DB
router.get('/:id', EmailController.getEmailStatus);

// Inspect BullMQ job status in Redis
router.get('/:id/job', EmailController.getJobStatus);

export default router;
