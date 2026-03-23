import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverAuth';
import { archiveSoldierToSheet } from '@/lib/serverSheetsBridge';

export async function POST(request) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { exportData } = await request.json();
    if (!exportData || typeof exportData !== 'object') {
      return NextResponse.json({ error: 'Missing exportData' }, { status: 400 });
    }

    const result = await archiveSoldierToSheet(exportData);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Archive export failed' }, { status: 500 });
  }
}
