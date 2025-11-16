import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

if (!RESEND_API_KEY || !FROM_EMAIL) {
  console.error('Missing RESEND_API_KEY or FROM_EMAIL in .env');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

app.use(cors({
  // For dev: allow everything. Later you can restrict origin to your extension.
  origin: '*',
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'focus-passkey-server' });
});

// Send passkey via email
app.post('/send-passkey', async (req, res) => {
  try {
    const { email, username, passkey } = req.body || {};

    if (!email || !passkey) {
      return res.status(400).json({ error: 'email and passkey are required' });
    }

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate passkey format (6 digits)
    if (!/^\d{6}$/.test(passkey)) {
      return res.status(400).json({ error: 'Passkey must be 6 digits' });
    }

    const subject = 'Your Friend Wants to Brainrot 😈';
    const greeting = username ? `Hi ${username},` : 'Hi,';
    const htmlContent = `
      <p>${greeting}</p>
      <p>Your friend wants to brainrot, so here's the passkey to help them:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0;">${passkey}</p>
      <p>Decide accordingly if you want to help them or not. 😏</p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">Enter this passkey in the extension to unlock.</p>
    `;
    const textContent =
      `${greeting}\n\n` +
      `Your friend wants to brainrot, so here's the passkey to help them:\n\n` +
      `${passkey}\n\n` +
      `Decide accordingly if you want to help them or not. 😏\n\n` +
      `Enter this passkey in the extension to unlock.`;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: subject,
      html: htmlContent,
      text: textContent,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return res.status(502).json({ error: 'Failed to send email', details: result.error });
    }

    return res.json({ ok: true, id: result.data?.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Resend FROM_EMAIL: ${FROM_EMAIL}`);
});

