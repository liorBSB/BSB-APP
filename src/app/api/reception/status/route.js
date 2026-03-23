import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { fetchReceptionRows } from '@/lib/serverSheetsBridge';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad'];

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { roomNumber } = await request.json();
    const room = String(roomNumber || '').trim();
    if (!room) {
      return NextResponse.json({ status: 'Home' });
    }

    const rows = await fetchReceptionRows();
    const match = rows.find((row) => String(row.room || '').trim() === room);
    const status = String(match?.status || '').trim();
    if (!status || status === 'Empty' || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ status: 'Home' });
    }
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ status: 'Home' });
  }
}
