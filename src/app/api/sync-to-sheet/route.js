import { NextResponse } from 'next/server';

const RECEPTION_SCRIPT_URL = process.env.NEXT_PUBLIC_RECEPTION_SCRIPT_URL;
const VALID_STATUSES = ['Home', 'Out', 'In base', 'Abroad'];

export async function POST(request) {
  try {
    const { roomNumber, newStatus } = await request.json();

    if (!RECEPTION_SCRIPT_URL) {
      return NextResponse.json({ success: false, message: 'Not configured' }, { status: 500 });
    }
    if (!roomNumber) {
      return NextResponse.json({ success: false, message: 'No room number' }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
    }

    const res = await fetch(`${RECEPTION_SCRIPT_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`GET failed: HTTP ${res.status}`);

    const soldiers = await res.json();
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

    const postRes = await fetch(RECEPTION_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: match.id, status: newStatus }),
    });

    if (!postRes.ok) throw new Error(`POST failed: HTTP ${postRes.status}`);

    const result = await postRes.json();
    if (result.status === 'success') {
      return NextResponse.json({ success: true });
    }

    throw new Error(result.message || 'Unknown error');
  } catch (err) {
    console.error('[sync-to-sheet] Failed:', err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
