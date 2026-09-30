import { authMiddleware, getDb } from 'lyzr-architect-pg'
import { candidates, organizations } from '@/lib/db/schema'
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
    const rows = await getDb().select().from(candidates).where(eq(candidates.organization_id, organizationId)).orderBy(desc(candidates.id))
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('[API] candidates GET error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load candidates' }, { status: 400 })
  }
})

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    if (!fullName) return NextResponse.json({ success: false, error: 'Candidate name is required' }, { status: 400 })
    const [row] = await getDb().insert(candidates).values({ organization_id: organizationId, full_name: fullName, email: typeof body.email === 'string' ? body.email : null, phone: typeof body.phone === 'string' ? body.phone : null, source: typeof body.source === 'string' ? body.source : 'direct_upload', resume_url: typeof body.resume_url === 'string' ? body.resume_url : null, metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : null }).returning()
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('[API] candidates POST error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create candidate' }, { status: 400 })
  }
})

export const PUT = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ success: false, error: 'Candidate id is required' }, { status: 400 })
    const [row] = await getDb().update(candidates).set({ ...(typeof body.full_name === 'string' ? { full_name: body.full_name } : {}), ...(typeof body.email === 'string' ? { email: body.email } : {}), ...(typeof body.phone === 'string' ? { phone: body.phone } : {}), ...(typeof body.source === 'string' ? { source: body.source } : {}), ...(typeof body.resume_url === 'string' ? { resume_url: body.resume_url } : {}), ...(typeof body.metadata === 'object' && body.metadata !== null ? { metadata: body.metadata } : {}) }).where(and(eq(candidates.id, id), eq(candidates.organization_id, organizationId))).returning()
    if (!row) return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('[API] candidates PUT error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to update candidate' }, { status: 400 })
  }
})

export const DELETE = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Candidate id is required' }, { status: 400 })
    await getDb().delete(candidates).where(and(eq(candidates.id, id), eq(candidates.organization_id, organizationId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] candidates DELETE error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to delete candidate' }, { status: 400 })
  }
})
