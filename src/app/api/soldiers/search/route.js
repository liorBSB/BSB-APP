import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { searchSoldiersInSheets } from '@/lib/serverSheetsBridge';

const FULL_NAME_COL = 'שם מלא                                  (מילוי אוטומטי: לא לגעת)';
const ID_COL = 'מספר זהות';
const ROOM_COL = 'חדר';

function toSafeSearchResult(row) {
  const idValue = String(row[ID_COL] || '').trim();
  return {
    fullName: row[FULL_NAME_COL] || '',
    roomNumber: row[ROOM_COL] || '',
    idSuffix: idValue ? idValue.slice(-4) : '',
    raw: row,
  };
}

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchTerm } = await request.json();
    const normalized = String(searchTerm || '').trim();
    if (normalized.length < 2) {
      return NextResponse.json({ soldiers: [] });
    }

    const matches = await searchSoldiersInSheets(normalized);
    return NextResponse.json({
      soldiers: matches.slice(0, 20).map(toSafeSearchResult),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
