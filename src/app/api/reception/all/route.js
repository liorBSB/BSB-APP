import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverAuth';
import { fetchReceptionRows } from '@/lib/serverSheetsBridge';

export async function GET(request) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const rows = await fetchReceptionRows();
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to fetch reception rows' }, { status: 500 });
  }
}
