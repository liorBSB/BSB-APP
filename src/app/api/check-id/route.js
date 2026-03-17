import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const { idNumber, uid } = await request.json();

    if (!idNumber || !uid) {
      return NextResponse.json(
        { error: 'Missing idNumber or uid' },
        { status: 400 }
      );
    }

    const normalized = String(idNumber).trim();
    const snapshot = await getAdminDb()
      .collection('users')
      .where('idNumber', '==', normalized)
      .get();

    const claimedByOther = snapshot.docs.some((doc) => doc.id !== uid);

    return NextResponse.json({ taken: claimedByOther });
  } catch (error) {
    console.error('check-id error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
