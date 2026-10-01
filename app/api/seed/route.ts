import { authMiddleware, getDb } from 'lyzr-architect-pg'
import {
  organization_members,
  organizations,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const userId = (req as unknown as { userId?: string }).userId
    if (!userId) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    const db = getDb()
    let [organization] = await db.select().from(organizations).where(eq(organizations.slug, `hireflow-${userId}`)).limit(1)

    if (!organization) {
      const [created] = await db.insert(organizations).values({ name: 'My Workspace', slug: `hireflow-${userId}`, status: 'active' }).returning()
      organization = created
    }
    if (!organization) return NextResponse.json({ success: false, error: 'Organization could not be created' }, { status: 500 })

    const existingMembership = await db.select().from(organization_members).where(eq(organization_members.organization_id, organization.id)).limit(1)
    if (existingMembership.length === 0) {
      await db.insert(organization_members).values({ organization_id: organization.id, role: 'recruiter', status: 'active' })
    }

    return NextResponse.json({
      success: true,
      seeded: false,
      data: { organization_id: organization.id },
    })
  } catch (error) {
    console.error('[API] seed POST error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Workspace initialization failed' }, { status: 400 })
  }
})
