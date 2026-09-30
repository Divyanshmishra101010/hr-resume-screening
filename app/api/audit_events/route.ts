import { authMiddleware, getDb } from 'lyzr-architect-pg'
import { audit_events, organizations } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

async function resolveOrganization(req: NextRequest) {
  const userId = (req as unknown as { userId?: string }).userId
  if (!userId) return null
  const [organization] = await getDb().select().from(organizations).where(eq(organizations.slug, `hireflow-${userId}`)).limit(1)
  return organization?.id ?? null
}

export const GET = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: true, data: [] })
    const rows = await getDb().select().from(audit_events).where(eq(audit_events.organization_id, organizationId)).orderBy(desc(audit_events.occurred_at)).limit(100)
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('[API] audit_events GET error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load audit events' }, { status: 400 })
  }
})

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const userId = (req as unknown as { userId?: string }).userId
    const organizationId = await resolveOrganization(req)
    if (!userId || !organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    const entityType = typeof body.entity_type === 'string' ? body.entity_type.trim() : ''
    const entityId = typeof body.entity_id === 'string' ? body.entity_id.trim() : null
    if (!action || !entityType) return NextResponse.json({ success: false, error: 'Action and entity type are required' }, { status: 400 })
    const [row] = await getDb().insert(audit_events).values({ organization_id: organizationId, actor_user_id: userId, action, entity_type: entityType, entity_id: entityId, details: typeof body.details === 'object' && body.details !== null ? body.details : null }).returning()
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('[API] audit_events POST error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to record audit event' }, { status: 400 })
  }
})
