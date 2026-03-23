import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAuth } from '@/lib/serverAuth';

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { idNumber } = await request.json();
    if (!idNumber) {
      return NextResponse.json({ error: 'Missing idNumber' }, { status: 400 });
    }

    const normalized = String(idNumber).trim();
    const snapshot = await getAdminDb()
      .collection('users')
      .where('idNumber', '==', normalized)
      .get();

    const taken = snapshot.docs.some((doc) => doc.id !== authResult.uid);
    return NextResponse.json({ taken });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
