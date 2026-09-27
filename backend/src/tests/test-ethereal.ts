import { MailerService } from '../services/mailer.service';

async function testEthereal() {
  console.log('🧪 Testing Nodemailer + Ethereal Email Integration...');
  try {
    const result = await MailerService.sendEmail({
      to: 'recipient-test@reachinbox-candidate.com',
      subject: 'Phase 2 Test Email - ReachInbox Assignment',
      body: 'Hello! This is a test email verifying Nodemailer and Ethereal preview link generation in Phase 2.',
    });

    console.log('\n--- Ethereal Test Result ---');
    console.log('Message ID:', result.messageId);
    console.log('Preview URL:', result.previewUrl);

    if (result.messageId && result.previewUrl) {
      console.log('\n✅ Ethereal Email integration verified successfully!');
      process.exit(0);
    } else {
      console.error('❌ Missing messageId or previewUrl');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Ethereal test failed:', err.message);
    process.exit(1);
  }
}

testEthereal();
