import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAuth } from '@/lib/serverAuth';

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

  try {
    const { subject, body, senderName, roomNumber, phone, screenshots } = await request.json();

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }

    const screenshotLinks = Array.isArray(screenshots) && screenshots.length > 0
      ? screenshots.map((url, i) => `Screenshot ${i + 1}: ${url}`).join('\n')
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to send feedback email:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
