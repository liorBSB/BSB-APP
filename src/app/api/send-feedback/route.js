import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAuth } from '@/lib/serverAuth';
import { takeRateLimit, applyRateLimitHeaders, resolveRateLimitClientId } from '@/lib/rateLimit';

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;
const MAX_SCREENSHOTS = 8;
const MAX_URL_LENGTH = 1000;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(request) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const limiterResult = takeRateLimit({
    key: `send-feedback:${authResult.uid}:${resolveRateLimitClientId(request)}`,
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiterResult.allowed) {
    const limited = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    return applyRateLimitHeaders(limited, limiterResult);
  }

  try {
    const { subject, body, senderName, roomNumber, phone, screenshots } = await request.json();

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }
    if (subject.trim().length > MAX_SUBJECT_LENGTH || body.trim().length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }
    if (Array.isArray(screenshots) && screenshots.length > MAX_SCREENSHOTS) {
      return NextResponse.json({ error: 'Too many screenshots' }, { status: 400 });
    }

    const screenshotLinks = Array.isArray(screenshots) && screenshots.length > 0
      ? screenshots
          .filter((url) => typeof url === 'string' && url.length > 0 && url.length <= MAX_URL_LENGTH)
          .map((url, i) => `Screenshot ${i + 1}: ${url}`)
          .join('\n')
      : '';

    const emailBody = [
      `From: ${senderName || 'Unknown'}`,
      `Room: ${roomNumber || 'N/A'}`,
      `Phone: ${phone || 'N/A'}`,
      '',
      '---',
      '',
      body.trim(),
      ...(screenshotLinks ? ['', '---', '', 'Screenshots:', screenshotLinks] : []),
    ].join('\n');

    await transporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to: 'bsb.happ1@gmail.com',
      subject: subject.trim(),
      text: emailBody,
    });

    return applyRateLimitHeaders(NextResponse.json({ ok: true }), limiterResult);
  } catch (err) {
    console.error('Failed to send feedback email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
