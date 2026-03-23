import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { fetchReceptionRows, updateReceptionStatusById } from '@/lib/serverSheetsBridge';

const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad'];

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ success: false, message: authResult.error }, { status: authResult.status });
    }

    const { roomNumber, newStatus } = await request.json();

    if (!roomNumber) {
      return NextResponse.json({ success: false, message: 'No room number' }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
    }

    const soldiers = await fetchReceptionRows();
    const match = soldiers.find(
      (s) => String(s.room || '').trim() === String(roomNumber).trim()
    );

    if (!match) {
      return NextResponse.json(
        { success: false, message: `Room ${roomNumber} not found in reception sheet` },
        { status: 404 }
      );
    }

    if (!match.id) {
      return NextResponse.json(
        { success: false, message: `Row for room ${roomNumber} has no id` },
        { status: 422 }
      );
    }

    await updateReceptionStatusById(match.id, newStatus);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[sync-to-sheet] Failed:', err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
