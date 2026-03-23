import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireOwnerOrAdmin } from '@/lib/serverAuth';
import { appToSheetRow, PRIMARY_KEY_APP, PRIMARY_KEY_SHEET } from '@/lib/sheetFieldMap';
import { updateSoldierInSheets } from '@/lib/serverSheetsBridge';

export async function POST(request) {
  try {
    const { userId, updateData } = await request.json();
    if (!userId || !updateData || typeof updateData !== 'object') {
      return NextResponse.json({ error: 'Missing userId or updateData' }, { status: 400 });
    }

    const authResult = await requireOwnerOrAdmin(request, userId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const userDoc = await getAdminDb().collection('users').doc(userId).get();
    const currentData = userDoc.exists ? userDoc.data() : {};
    const merged = { ...currentData, ...updateData };
    const idNumber = String(
      merged[PRIMARY_KEY_APP] || merged.personalNumber || currentData?.[PRIMARY_KEY_APP] || ''
    ).trim();
    if (!idNumber) {
      return NextResponse.json({ success: false, message: 'No ID number — cannot match to sheet row' });
    }

    const sheetPayload = appToSheetRow(merged);
    sheetPayload[PRIMARY_KEY_SHEET] = idNumber;

    const result = await updateSoldierInSheets(sheetPayload);
    return NextResponse.json({ success: true, message: result.message || 'Synced to sheets' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
