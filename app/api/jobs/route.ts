import { authMiddleware, getDb } from 'lyzr-architect-pg'
import { jobs, organizations } from '@/lib/db/schema'
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
    const rows = await getDb().select().from(jobs).where(eq(jobs.organization_id, organizationId)).orderBy(desc(jobs.id))
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('[API] jobs GET error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load jobs' }, { status: 400 })
  }
})

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ success: false, error: 'Role title is required' }, { status: 400 })
    const [row] = await getDb().insert(jobs).values({ organization_id: organizationId, title, description: typeof body.description === 'string' ? body.description : null, status: typeof body.status === 'string' ? body.status : 'open', department: typeof body.department === 'string' ? body.department : null, employment_type: typeof body.employment_type === 'string' ? body.employment_type : null, location: typeof body.location === 'string' ? body.location : null, metadata: {} }).returning()
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('[API] jobs POST error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create job' }, { status: 400 })
  }
})

export const PUT = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ success: false, error: 'Job id is required' }, { status: 400 })
    const [row] = await getDb().update(jobs).set({ ...(typeof body.title === 'string' ? { title: body.title } : {}), ...(typeof body.description === 'string' ? { description: body.description } : {}), ...(typeof body.status === 'string' ? { status: body.status } : {}), ...(typeof body.department === 'string' ? { department: body.department } : {}), ...(typeof body.employment_type === 'string' ? { employment_type: body.employment_type } : {}), ...(typeof body.location === 'string' ? { location: body.location } : {}) }).where(and(eq(jobs.id, id), eq(jobs.organization_id, organizationId))).returning()
    if (!row) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('[API] jobs PUT error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to update job' }, { status: 400 })
  }
})

export const DELETE = authMiddleware(async (req: NextRequest) => {
  try {
    const organizationId = await resolveOrganization(req)
    if (!organizationId) return NextResponse.json({ success: false, error: 'Workspace seed required' }, { status: 403 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Job id is required' }, { status: 400 })
    await getDb().delete(jobs).where(and(eq(jobs.id, id), eq(jobs.organization_id, organizationId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] jobs DELETE error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to delete job' }, { status: 400 })
  }
})
