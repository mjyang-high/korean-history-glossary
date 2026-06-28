import { NextResponse } from 'next/server';
import { getTopTerms } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const topTerms = await getTopTerms(10);
  return NextResponse.json({ topTerms });
}
