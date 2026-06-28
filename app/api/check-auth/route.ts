import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isValidAuthToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const ok = await isValidAuthToken(token);
  return NextResponse.json({ ok });
}
