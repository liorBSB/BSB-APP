import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad', 'Empty'];

export async function POST(request) {
  try {
    const secret = request.headers.get('x-webhook-secret');
    if (!process.env.STATUS_WEBHOOK_SECRET || secret !== process.env.STATUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { room, status } = await request.json();

    if (!room || !status) {
      return NextResponse.json({ error: 'Missing room or status' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    if (status === 'Empty') {
      return NextResponse.json({ success: true, message: 'Empty status ignored (sheet-only)' });
    }

    const roomTrimmed = String(room).trim();
    const snapshot = await getAdminDb()
      .collection('users')
      .where('roomNumber', '==', roomTrimmed)
      .where('userType', '==', 'user')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, message: `No user found for room ${roomTrimmed}` },
        { status: 404 }
      );
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Status updated to ${status} for room ${roomTrimmed}`,
    });
  } catch (error) {
    console.error('[status-webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
