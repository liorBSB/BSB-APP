export async function POST(request) {
  const { code } = await request.json();
  console.log('Received code:', code, 'Env code:', process.env.ADMIN_CODE);
  if (code === process.env.ADMIN_CODE) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } else {
    return new Response(JSON.stringify({ error: 'Invalid code' }), { status: 401 });
  }
} 