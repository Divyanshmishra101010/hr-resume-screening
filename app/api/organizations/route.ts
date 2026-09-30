import { authMiddleware, getDb } from 'lyzr-architect-pg'
import { organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export const GET = authMiddleware(async (req: NextRequest) => {
  try {
    const userId = (req as unknown as { userId?: string }).userId
    if (!userId) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    const rows = await getDb().select().from(organizations).where(eq(organizations.slug, `hireflow-${userId}`))
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('[API] organizations GET error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load organization' }, { status: 400 })
  }
})
