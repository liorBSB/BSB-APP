import { NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    let parsed;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return NextResponse.json({ error: 'URL host not allowed' }, { status: 403 });
    }

    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PDF-Generator/1.0)' },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: 502 },
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Response is not an image' }, { status: 400 });
    }

    const imageBuffer = await response.arrayBuffer();
    const download = searchParams.get('download') === '1';
    const customName = searchParams.get('name');
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';

    const resHeaders = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    };
    if (download) {
      const filename = customName ? `${customName}.${ext}` : `photo.${ext}`;
      resHeaders['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    return new NextResponse(imageBuffer, { status: 200, headers: resHeaders });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
