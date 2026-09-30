import { authMiddleware, getDb } from 'lyzr-architect-pg'
import { integration_connections, organizations } from '@/lib/db/schema'
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
    const rows = await getDb().select().from(integration_connections).where(eq(integration_connections.organization_id, organizationId)).orderBy(desc(integration_connections.id))
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('[API] integration_connections GET error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load integration health' }, { status: 400 })
  }
})

export const PUT = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ success: false, error: 'Integration id is required' }, { status: 400 })
    const [row] = await getDb().update(integration_connections).set({ ...(typeof body.status === 'string' ? { status: body.status } : {}), ...(typeof body.account_email === 'string' ? { account_email: body.account_email } : {}), ...(body.last_synced_at ? { last_synced_at: new Date(String(body.last_synced_at)) } : {}) }).where(and(eq(integration_connections.id, id), eq(integration_connections.organization_id, organizationId))).returning()
    if (!row) return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('[API] integration_connections PUT error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to update integration health' }, { status: 400 })
  }
})
