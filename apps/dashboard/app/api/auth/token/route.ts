import { withAuth } from '@repo/auth/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await withAuth();
  if (!session.user || !session.accessToken) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json({ token: session.accessToken });
}
