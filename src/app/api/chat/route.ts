import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, message: 'stub GET' });
}

export async function POST(req: Request) {
  try { await req.json(); } catch {}
  return NextResponse.json({ ok: true, message: 'stub POST' });
}
