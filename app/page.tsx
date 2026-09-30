'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import { AuthProvider, LoginForm, ProtectedRoute, RegisterForm, UserMenu, useAuth } from 'lyzr-architect-pg/client'
import { Toaster, toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Globe2,
  Inbox,
  Info,
  Loader2,
  Lock,
  Mail,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const ORCHESTRATOR_ID = '6abc7bc621093ae263023121'
const SCREENER_ID = '6abc7b6bbb0e214159113204'

type View = 'roles' | 'jobs' | 'criteria' | 'candidates' | 'interviews' | 'integrations' | 'audit'
type Provider = 'google' | 'microsoft' | 'both'
type CriteriaType = 'required' | 'preferred' | 'disqualifying' | 'contextual'
type WarningSeverity = 'info' | 'warning' | 'blocking'

type AgentDescriptor = {
  id: string
  name: string
  purpose: string
  provider: string
}

const POWERING_AGENTS: AgentDescriptor[] = [
  { id: ORCHESTRATOR_ID, name: 'Recruitment Orchestrator', purpose: 'Routes intake, screening, approval, and scheduling', provider: 'Anthropic' },
  { id: '6abc7b35263d4a0614bb8530', name: 'Gmail Resume Intake', purpose: 'Finds and normalizes resume attachments from Gmail', provider: 'Gmail · Composio' },
  { id: '6abc7b5021093ae26302311d', name: 'Outlook Resume Intake', purpose: 'Finds and normalizes resume attachments from Outlook', provider: 'Outlook · ACI' },
  { id: '6abc7b6bbb0e214159113204', name: 'Evidence-Based Screener', purpose: 'Scores approved criteria against cited resume evidence', provider: 'Screening' },
  { id: '6abc7b807f82a7619cd00537', name: 'Google Interview Coordinator', purpose: 'Checks Google Calendar availability before approval', provider: 'Google Calendar' },
  { id: '6abc7b92d6b1df16df74f590', name: 'Microsoft Interview Coordinator', purpose: 'Checks Microsoft availability before approval', provider: 'Microsoft 365' },
]

type Warning = {
  code: string
  message: string
  severity: WarningSeverity
  requires_human_review: boolean
  source_id?: string
}

type EvidenceExcerpt = {
  quote: string
  source_id: string
  locator: string
}

type CriterionScore = {
  criterion_id: string
  score: number
  evidence_excerpts: EvidenceExcerpt[]
  reasoning: string
  confidence: number
  missing_evidence: boolean
  uncertainty: string
  protected_attribute_excluded: boolean
}

type CandidateAssessment = {
  candidate_id: string
  source_ids: string[]
  assessment_id: string
  overall_score: number
  required_criteria_coverage: number
  confidence: number
  rank_position: number
  criterion_scores: CriterionScore[]
  strengths: string[]
  gaps: string[]
  warnings: Warning[]
  recommended_next_action: 'review_evidence' | 'advance_for_human_review' | 'hold_for_more_information' | 'resolve_warning' | 'none'
  autonomous_rejection: false
}

type Criterion = {
  criterion_id: string
  label: string
  criterion_type: CriteriaType
  minimum_match: number
  weight: number
  approved: boolean
  job_relevance_note: string
}

type CandidateSourceRecord = {
  candidate_id: string
  source_id: string
  source_provider: 'gmail' | 'microsoft_outlook' | 'direct_upload'
  message_or_attachment_locator: string
  recruiter_review_required: boolean
  duplicate_candidate_ids: string[]
  parse_status: 'parsed' | 'partial' | 'failed' | 'not_run'
  warnings: Warning[]
  attachment_filename?: string
  attachment_id?: string
  message_id?: string
  sender_email?: string
  received_at?: string
  identity?: { display_name: string; email: string }
  source_locator?: string
  extracted_text_status?: 'not_requested' | 'extracted' | 'unreadable' | 'missing'
  evidence_provenance?: string
}

type Participant = {
  participant_id: string
  display_name: string
  email: string
  role: 'candidate' | 'recruiter' | 'hiring_manager' | 'interviewer' | 'other'
  time_zone: string
  calendar_id: string
}

type ConstraintSet = {
  interview_type: string
  duration_minutes: number
  buffer_minutes: number
  date_range_start: string
  date_range_end: string
  working_hours_start: string
  working_hours_end: string
  time_zone: string
  candidate_availability_source: 'recruiter_entered' | 'app_supplied' | 'unknown'
}

type SlotOption = {
  slot_id: string
  start: string
  end: string
  time_zone: string
  provider: 'google' | 'microsoft'
  calendar_ids_checked: string[]
  participant_availability_confirmed: boolean
  freshness: string
  status: 'proposed' | 'selected' | 'stale' | 'invalid'
}

type ProviderOption = {
  provider: 'google' | 'microsoft'
  scheduling_draft_id: string
  approval_state: 'pending' | 'approved' | 'rejected' | 'stale' | 'invalid'
  requires_explicit_recruiter_approval: true
  proposed_slots: SlotOption[]
  selected_slot_id: string
  event_id: string
  message_id: string
  meeting_link: string
  event_title: string
  message_preview: string
  warnings: Warning[]
  freshness: string
  audit_event_ids: string[]
}

type Scheduling = {
  scheduling_workflow_status: 'not_requested' | 'options_ready' | 'approval_required' | 'approved_and_created' | 'stale_requires_refresh' | 'blocked' | 'error'
  provider: 'none' | 'google' | 'microsoft' | 'both'
  scheduling_draft_id: string
  application_id: string
  approval_state: 'not_required' | 'pending' | 'approved' | 'rejected' | 'stale' | 'invalid'
  approval_reference: string
  participants: Participant[]
  constraints: ConstraintSet
  proposed_slots: SlotOption[]
  provider_options: ProviderOption[]
  selected_slot_id: string
  event_id: string
  message_id: string
  meeting_link: string
  event_title: string
  message_preview: string
  warnings: Warning[]
  audit_event_ids: string[]
  invitation_created: false
  invitation_requires_explicit_recruiter_approval: true
}

type CandidateIdentity = {
  display_name: string
  email: string
  phone: string
}

type OrchestratorData = {
  workflow_status: string
  item_requires_recruiter_attention: boolean
  role_id: string
  candidate_identity: CandidateIdentity
  candidate_id: string
  source_ids: string[]
  assessment_id: string
  criteria_version_id: string
  ranking_snapshot_id: string
  candidate_source_records: CandidateSourceRecord[]
  criteria: Criterion[]
  candidate_assessments: CandidateAssessment[]
  ranking_explanation: string
  material_tie_breakers: string[]
  scheduling: Scheduling
  warnings: Warning[]
  audit_event_ids: string[]
  recommended_next_action: string
  autonomous_rejection: false
  recruiter_approval_reference: string
}

type AgentMetadata = {
  agent_name: string
  timestamp: string
  sub_agents_used: string[]
}

type JobRecord = {
  id: string
  title: string
  description: string
  status: string
  department: string
  employment_type: string
  location: string
}

type CandidateRecord = {
  id: string
  full_name: string
  email: string
  phone: string
  source: string
  resume_url: string
  application_id?: string
  application_stage?: string
}

type RoleApplicationPacket = {
  application: { id: string; job_id: string; candidate_id: string; stage: string; status: string; metadata?: Record<string, unknown> }
  candidate: CandidateRecord | null
  assessment: { id: string; overall_score: string | number | null; notes: string | null; status: string } | null
  criterion_scores: Array<{ job_criterion_id: string; score: string | number; notes: string | null }>
  documents: Array<{ id: string; file_name: string | null; parsed_content: unknown }>
}

type IntegrationRecord = {
  id: string
  provider: string
  account_email: string
  status: string
  connected_at: string
  last_synced_at: string
}

type AuditRecord = {
  id: string
  actor_user_id: string
  action: string
  entity_type: string
  entity_id: string
  details: Record<string, unknown>
  occurred_at: string
}

type CriteriaRecord = {
  id: string
  job_id: string
  name: string
  criterion_type: CriteriaType
  description: string
  minimum_match: number
  weight: number
  approved: boolean
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="mt-3 text-sm font-semibold">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="mt-3 text-base font-semibold">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="mt-4 text-lg font-bold">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseDateLabel(value: string) {
  return value ? value.replace('T', ' · ').replace('Z', '') : 'Not available'
}

function extractCriteria(value: unknown): Criterion[] {
  if (typeof value === 'string') {
    try { return extractCriteria(JSON.parse(value)) } catch { return [] }
  }
  if (!isRecord(value)) return []
  if (Array.isArray(value.criteria)) {
    const rows = value.criteria.filter(isRecord).map((row, index) => {
      const type = asText(row.criterion_type, index < 3 ? 'required' : 'preferred') as CriteriaType
      return { criterion_id: `new-${crypto.randomUUID()}`, label: asText(row.label, asText(row.name, `Criterion ${index + 1}`)), criterion_type: ['required', 'preferred', 'disqualifying', 'contextual'].includes(type) ? type : 'preferred', minimum_match: asNumber(row.minimum_match, type === 'required' ? 70 : 50), weight: Math.max(0, asNumber(row.weight, 1)), approved: false, job_relevance_note: asText(row.job_relevance_note, asText(row.description, 'Relevant evidence for successful performance in this role.')) }
    })
    const total = rows.reduce((sum, row) => sum + row.weight, 0) || rows.length
    let assigned = 0
    return rows.map((row, index) => { const weight = index === rows.length - 1 ? 100 - assigned : Math.round((row.weight / total) * 100); assigned += weight; return { ...row, weight } })
  }
  for (const key of ['result', 'response', 'data', 'output']) {
    if (key in value) { const nested = extractCriteria(value[key]); if (nested.length) return nested }
  }
  return []
}

function extractScreening(value: unknown): { full_name: string; email: string; overall_score?: number; notes: string; criterion_scores: CriterionScore[] } | null {
  if (typeof value === 'string') { try { return extractScreening(JSON.parse(value)) } catch { return null } }
  if (!isRecord(value)) return null
  const assessments = Array.isArray(value.candidate_assessments) ? value.candidate_assessments.filter(isRecord) : []
  const assessment = assessments[0]
  const identity = isRecord(value.candidate_identity) ? value.candidate_identity : {}
  if (assessment) return { full_name: asText(identity.display_name, 'Resume candidate'), email: asText(identity.email), overall_score: asNumber(assessment.overall_score), notes: asText(value.ranking_explanation, 'Resume screening completed.'), criterion_scores: Array.isArray(assessment.criterion_scores) ? assessment.criterion_scores.filter(isRecord).map((score) => ({ criterion_id: asText(score.criterion_id), score: asNumber(score.score), evidence_excerpts: [], reasoning: asText(score.reasoning), confidence: asNumber(score.confidence, 0.75), missing_evidence: score.missing_evidence === true, uncertainty: asText(score.uncertainty), protected_attribute_excluded: true })) : [] }
  for (const key of ['result', 'response', 'data', 'output']) { if (key in value) { const nested = extractScreening(value[key]); if (nested) return nested } }
  return null
}

function fallbackCriteria(job: JobRecord): Criterion[] {
  const text = `${job.title} ${job.description}`.toLowerCase()
  const labels = text.includes('python') ? ['Python development', 'API development', 'Databases and SQL', 'Testing and code quality', 'System design', text.includes('ai') || text.includes('genai') ? 'Applied AI and LLMs' : 'Cloud deployment'] : text.includes('design') ? ['Product strategy', 'Design systems', 'User research', 'Interaction design', 'Stakeholder collaboration', 'Delivery ownership'] : ['Core role expertise', 'Relevant delivery experience', 'Problem solving', 'Quality practices', 'Stakeholder collaboration', 'Role-specific tools']
  const weights = [25, 20, 15, 15, 15, 10]
  return labels.map((label, index) => ({ criterion_id: `new-${crypto.randomUUID()}`, label, criterion_type: index < 4 ? 'required' : 'preferred', minimum_match: index < 4 ? 70 : 50, weight: weights[index], approved: false, job_relevance_note: `Evidence of ${label.toLowerCase()} relevant to the responsibilities described for ${job.title}.` }))
}

function isOrchestratorData(value: unknown): value is OrchestratorData {
  if (!isRecord(value)) return false
  const requiredStrings = ['workflow_status', 'role_id', 'assessment_id', 'criteria_version_id', 'ranking_snapshot_id', 'ranking_explanation', 'recommended_next_action', 'recruiter_approval_reference']
  if (!requiredStrings.every((key) => typeof value[key] === 'string')) return false
  if (typeof value.item_requires_recruiter_attention !== 'boolean' || typeof value.autonomous_rejection !== 'boolean') return false
  if (value.autonomous_rejection !== false) return false
  if (!isRecord(value.candidate_identity) || !Array.isArray(value.source_ids) || !Array.isArray(value.candidate_source_records) || !Array.isArray(value.criteria) || !Array.isArray(value.candidate_assessments) || !Array.isArray(value.material_tie_breakers) || !isRecord(value.scheduling) || !Array.isArray(value.warnings) || !Array.isArray(value.audit_event_ids)) return false
  return true
}

function statusClasses(status: string) {
  if (status === 'approved' || status === 'healthy' || status === 'parsed' || status === 'screening_completed' || status === 'ranking_ready' || status === 'approved_and_created') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (status === 'warning' || status === 'pending' || status === 'partial' || status === 'criteria_approval_required' || status === 'approval_required') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
  if (status === 'blocking' || status === 'failed' || status === 'error' || status === 'stale') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
  return 'border-border bg-muted text-muted-foreground'
}

function StatusBadge({ value, label }: { value: string; label?: string }) {
  return <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClasses(value)}`}>{label ?? value.replaceAll('_', ' ')}</Badge>
}

function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('theme')
    const nextDark = saved === 'dark'
    document.documentElement.classList.toggle('dark', nextDark)
    setDark(nextDark)
  }, [])

  const toggleTheme = () => {
    const nextDark = !dark
    setDark(nextDark)
    document.documentElement.classList.toggle('dark', nextDark)
    window.localStorage.setItem('theme', nextDark ? 'dark' : 'light')
  }

  return (
    <Button type="button" variant="outline" size="icon" onClick={toggleTheme} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Use light theme' : 'Use dark theme'} className="h-10 w-10 rounded-xl border-border bg-card transition-colors hover:bg-muted active:scale-[0.98]">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function BrandMark() {
  return <div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">H</div><span className="font-semibold tracking-tight">HireFlow</span></div>
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  return (
    <main className="min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
        <section className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full border-[64px] border-primary-foreground/10" />
          <div className="relative z-10"><BrandMark /></div>
          <div className="relative z-10 max-w-xl pb-10">
            <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">Recruitment operations / human control</p>
            <h1 className="max-w-2xl text-balance font-serif text-5xl leading-[1.03] tracking-tight xl:text-6xl">Hiring evidence,<span className="block italic text-primary-foreground/70">not black boxes.</span></h1>
            <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-primary-foreground/70">Screen candidates consistently, understand every score, and keep people in control of every hiring and scheduling decision.</p>
            <div className="mt-10 border-l border-primary-foreground/30 pl-5 text-sm leading-6 text-primary-foreground/75">Every recommendation links back to approved criteria and cited evidence from the candidate’s resume.</div>
          </div>
          <div className="relative z-10 flex items-center gap-2 text-xs text-primary-foreground/55"><ShieldCheck className="h-4 w-4" /> Designed to support fair, reviewable decisions.</div>
        </section>
        <section className="flex min-h-screen items-center justify-center p-5 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:justify-end"><div className="lg:hidden"><BrandMark /></div><ThemeToggle /></div>
            <div className="mb-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Recruitment operations</p>
              <h2 className="mt-3 text-balance font-serif text-4xl tracking-tight">Welcome to HireFlow</h2>
              <p className="mt-2 text-sm text-muted-foreground">Sign in or create your organization workspace.</p>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              <Button type="button" variant={mode === 'login' ? 'default' : 'ghost'} onClick={() => setMode('login')} className="h-10 rounded-lg text-sm">Sign in</Button>
              <Button type="button" variant={mode === 'register' ? 'default' : 'ghost'} onClick={() => setMode('register')} className="h-10 rounded-lg text-sm">Create account</Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
              {mode === 'login' ? <LoginForm onSwitchToRegister={() => setMode('register')} /> : <RegisterForm onSwitchToLogin={() => setMode('login')} />}
            </div>
            <div className="mt-5 flex gap-2 rounded-xl border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>HireFlow supports human decision-making. It never makes autonomous hiring decisions or scores protected characteristics.</span></div>
          </div>
        </section>
      </div>
    </main>
  )
}

function AgentStatusStrip({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <Card className="border-border/80 bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Powering this workspace</p><p className="mt-1 text-sm text-muted-foreground">Provider access is already authorized; actions remain recruiter-approved.</p></div><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><CircleDot className="mr-1.5 h-3 w-3" /> 6 agents ready</Badge></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {POWERING_AGENTS.map((agent) => {
            const active = activeAgentId === agent.id
            return <div key={agent.id} className="min-w-0 rounded-xl border border-border bg-background/60 p-3"><div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${active ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-xs font-semibold">{agent.name}</p>{active && <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">working</Badge>}</div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{agent.purpose}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground/70">{agent.provider}</p></div></div></div>
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function WarningList({ warnings, compact = false }: { warnings: Warning[]; compact?: boolean }) {
  if (!Array.isArray(warnings) || warnings.length === 0) return <p className="text-xs text-muted-foreground">No warnings recorded.</p>
  return <div className="space-y-2">{warnings.map((warning, index) => <div key={`${warning.code}-${index}`} className={`rounded-xl border p-3 ${statusClasses(warning.severity)}`}><div className="flex items-start gap-2">{warning.severity === 'blocking' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : warning.severity === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}<div className="min-w-0"><p className="text-xs font-semibold">{warning.code}</p><p className={`${compact ? 'line-clamp-2' : ''} mt-1 text-xs leading-5`}>{warning.message}</p>{warning.source_id && <p className="mt-1 font-mono text-[10px] opacity-75">Source: {warning.source_id}</p>}<p className="mt-1 text-[10px] font-medium">{warning.requires_human_review ? 'Human review required' : 'Informational'}</p></div></div></div>)}</div>
}

function MetricStrip({ jobs, candidates, integrations, pendingCriteria }: { jobs: JobRecord[]; candidates: CandidateRecord[]; integrations: IntegrationRecord[]; pendingCriteria: number }) {
  const healthy = integrations.filter((item) => item.status === 'healthy').length
  const metrics = [{ label: 'Open roles', value: jobs.length, note: `${pendingCriteria} need criteria approval` }, { label: 'Candidates in workspace', value: candidates.length, note: 'Across active roles' }, { label: 'Healthy connections', value: healthy, note: 'Inbox and calendar providers' }]
  return <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">{metrics.map((metric) => <div key={metric.label} className="bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p><p className="mt-3 font-serif text-4xl tabular-nums tracking-tight">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.note}</p></div>)}</div>
}

function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground"><FileText className="h-5 w-5" /></div><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{actionLabel && onAction && <Button type="button" variant="outline" onClick={onAction} className="mt-5 rounded-xl active:scale-[0.98]"><Plus className="mr-2 h-4 w-4" />{actionLabel}</Button>}</div>
}

const sampleJobs: JobRecord[] = [
  { id: 'role-product-design', title: 'Senior Product Designer', description: 'Lead product discovery, systems thinking, and design quality for a B2B workflow platform.', status: 'open', department: 'Product', employment_type: 'Full-time', location: 'Remote · US time zones' },
  { id: 'role-revenue-ops', title: 'Revenue Operations Manager', description: 'Build the operating system for pipeline quality, forecasting, and cross-functional execution.', status: 'open', department: 'Operations', employment_type: 'Full-time', location: 'New York · Hybrid' },
  { id: 'role-frontend', title: 'Frontend Engineer', description: 'Ship accessible, resilient product surfaces with a TypeScript and React platform team.', status: 'open', department: 'Engineering', employment_type: 'Full-time', location: 'Remote' },
  { id: 'role-success', title: 'Customer Success Lead', description: 'Create a thoughtful customer operating model for high-growth accounts.', status: 'open', department: 'Customer', employment_type: 'Full-time', location: 'San Francisco · Hybrid' },
]

const sampleCandidates: CandidateRecord[] = [
  { id: 'candidate-maya', full_name: 'Maya Chen', email: 'maya.chen@example.com', phone: '+1 415 555 0142', source: 'gmail', resume_url: '' },
  { id: 'candidate-jordan', full_name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '+1 206 555 0118', source: 'direct_upload', resume_url: '' },
  { id: 'candidate-sam', full_name: 'Sam Okafor', email: 'sam.okafor@example.com', phone: '+1 312 555 0194', source: 'microsoft_outlook', resume_url: '' },
  { id: 'candidate-elena', full_name: 'Elena Petrov', email: 'elena.petrov@example.com', phone: '+1 646 555 0164', source: 'direct_upload', resume_url: '' },
]

const sampleIntegrations: IntegrationRecord[] = [
  { id: 'integration-gmail', provider: 'gmail', account_email: 'recruiting@northstar.co', status: 'healthy', connected_at: '2026-09-28T09:00:00Z', last_synced_at: '2026-09-30T08:42:00Z' },
  { id: 'integration-outlook', provider: 'microsoft_outlook', account_email: 'talent@northstar.co', status: 'healthy', connected_at: '2026-09-28T09:12:00Z', last_synced_at: '2026-09-30T08:38:00Z' },
  { id: 'integration-google-calendar', provider: 'googlecalendar', account_email: 'priya@northstar.co', status: 'healthy', connected_at: '2026-09-28T09:20:00Z', last_synced_at: '2026-09-30T08:40:00Z' },
  { id: 'integration-microsoft-calendar', provider: 'microsoft_calendar', account_email: 'alex@northstar.co', status: 'healthy', connected_at: '2026-09-28T09:25:00Z', last_synced_at: '2026-09-30T08:41:00Z' },
]

const sampleCriteria: Criterion[] = [
  { criterion_id: 'criterion-strategy', label: 'Product strategy', criterion_type: 'required', minimum_match: 70, weight: 30, approved: true, job_relevance_note: 'Direct evidence of shaping product direction and discovery decisions.' },
  { criterion_id: 'criterion-systems', label: 'Design systems', criterion_type: 'required', minimum_match: 70, weight: 25, approved: true, job_relevance_note: 'Evidence of creating or governing reusable design patterns.' },
  { criterion_id: 'criterion-research', label: 'User research', criterion_type: 'required', minimum_match: 65, weight: 20, approved: true, job_relevance_note: 'Evidence of research methods tied to product outcomes.' },
  { criterion_id: 'criterion-leadership', label: 'People leadership', criterion_type: 'preferred', minimum_match: 50, weight: 15, approved: true, job_relevance_note: 'Relevant mentoring or management scope; missing evidence stays uncertain.' },
  { criterion_id: 'criterion-b2b', label: 'B2B workflow experience', criterion_type: 'preferred', minimum_match: 50, weight: 10, approved: true, job_relevance_note: 'Relevant complexity and stakeholder context for this role.' },
]

function makeAssessment(candidateId: string, score: number, coverage: number, confidence: number, rank: number, strengths: string[], gaps: string[], nextAction: CandidateAssessment['recommended_next_action']): CandidateAssessment {
  const isMaya = candidateId === 'candidate-maya'
  return {
    candidate_id: candidateId,
    source_ids: [isMaya ? 'gmail-source-104' : `${candidateId}-resume-source`],
    assessment_id: `${candidateId}-assessment-v3`,
    overall_score: score,
    required_criteria_coverage: coverage,
    confidence,
    rank_position: rank,
    criterion_scores: [
      { criterion_id: 'criterion-strategy', score: isMaya ? 4 : score > 84 ? 4 : 3, evidence_excerpts: [{ quote: isMaya ? 'Led zero-to-one discovery and product strategy for a B2B workflow platform.' : 'Partnered with product leaders to frame roadmap decisions and customer problems.', source_id: isMaya ? 'gmail-source-104' : `${candidateId}-resume-source`, locator: 'Resume · p1' }], reasoning: 'The resume includes direct, job-relevant evidence connected to product direction.', confidence, missing_evidence: false, uncertainty: 'No material uncertainty in the cited strategy evidence.', protected_attribute_excluded: true },
      { criterion_id: 'criterion-systems', score: isMaya ? 4 : score > 82 ? 4 : 3, evidence_excerpts: [{ quote: isMaya ? 'Built and governed a 60-component design system used by 8 squads.' : 'Created reusable component guidance adopted across multiple product teams.', source_id: isMaya ? 'gmail-source-104' : `${candidateId}-resume-source`, locator: 'Resume · p1' }], reasoning: 'Reusable systems work is explicitly described and relevant to the approved criterion.', confidence, missing_evidence: false, uncertainty: 'Scale of governance is described at a high level.', protected_attribute_excluded: true },
      { criterion_id: 'criterion-research', score: isMaya ? 4 : score > 84 ? 3 : 3, evidence_excerpts: [{ quote: isMaya ? 'Combined moderated research with funnel analysis to reduce activation friction by 18%.' : 'Ran customer interviews and usability studies to improve onboarding decisions.', source_id: isMaya ? 'gmail-source-104' : `${candidateId}-resume-source`, locator: 'Resume · p2' }], reasoning: 'Research methods are connected to a measurable product outcome.', confidence: Math.max(0.72, confidence - 0.04), missing_evidence: false, uncertainty: 'The resume does not detail every research sample or method.', protected_attribute_excluded: true },
      { criterion_id: 'criterion-leadership', score: isMaya ? 3 : score > 80 ? 3 : 2, evidence_excerpts: isMaya ? [{ quote: 'Mentored four designers through critique and career development.', source_id: 'gmail-source-104', locator: 'Resume · p2' }] : [], reasoning: isMaya ? 'Clear mentoring evidence; direct management scope is not stated.' : 'Some collaboration evidence is present, but leadership scope is not fully described.', confidence: 0.66, missing_evidence: !isMaya, uncertainty: isMaya ? 'Direct people-management scope is not stated.' : 'No direct evidence of people leadership was found; this is not proof of absence.', protected_attribute_excluded: true },
      { criterion_id: 'criterion-b2b', score: isMaya ? 4 : score > 83 ? 3 : 2, evidence_excerpts: isMaya ? [{ quote: 'Owned workflow design for a multi-tenant operations platform.', source_id: 'gmail-source-104', locator: 'Resume · p1' }] : [], reasoning: isMaya ? 'Relevant B2B workflow context is directly stated.' : 'Relevant context is partially described and should be reviewed by a recruiter.', confidence: 0.78, missing_evidence: !isMaya, uncertainty: isMaya ? 'Industry context is clear; customer segment detail is limited.' : 'The resume leaves the workflow complexity unclear.', protected_attribute_excluded: true },
    ],
    strengths,
    gaps,
    warnings: isMaya ? [{ code: 'LEADERSHIP_SCOPE_UNCLEAR', message: 'Mentoring is cited, while direct management scope is not stated.', severity: 'info', requires_human_review: true }] : [],
    recommended_next_action: nextAction,
    autonomous_rejection: false,
  }
}

const sampleAssessments: CandidateAssessment[] = [
  makeAssessment('candidate-maya', 91, 1, 0.93, 1, ['Clear product strategy evidence', 'Design system governance at scale', 'B2B workflow context'], ['Direct management scope is not stated.'], 'advance_for_human_review'),
  makeAssessment('candidate-jordan', 87, 1, 0.88, 2, ['Strong systems practice', 'Clear research-to-outcome link'], ['B2B workflow context needs review.'], 'review_evidence'),
  makeAssessment('candidate-sam', 81, 0.8, 0.76, 3, ['Product discovery experience', 'Cross-functional delivery'], ['One required criterion has partial evidence.'], 'review_evidence'),
  makeAssessment('candidate-elena', 78, 1, 0.71, 4, ['Full required coverage cited', 'Good collaboration signals'], ['Leadership evidence is limited; review the source text.'], 'hold_for_more_information'),
]

const sampleOrchestratorData: OrchestratorData = {
  workflow_status: 'ranking_ready',
  item_requires_recruiter_attention: true,
  role_id: 'role-product-design',
  candidate_identity: { display_name: 'Maya Chen', email: 'maya.chen@example.com', phone: '+1 415 555 0142' },
  candidate_id: 'candidate-maya',
  source_ids: ['gmail-source-104'],
  assessment_id: 'candidate-maya-assessment-v3',
  criteria_version_id: 'criteria-product-design-v3',
  ranking_snapshot_id: 'ranking-product-design-v3',
  candidate_source_records: [
    { candidate_id: 'candidate-maya', source_id: 'gmail-source-104', source_provider: 'gmail', message_or_attachment_locator: 'Gmail thread · recruiting@northstar.co · msg-104 / maya-chen-resume.pdf', recruiter_review_required: true, duplicate_candidate_ids: [], parse_status: 'parsed', warnings: [], attachment_filename: 'maya-chen-resume.pdf', attachment_id: 'attachment-104', message_id: 'msg-104', sender_email: 'maya.chen@example.com', received_at: '2026-09-30T06:42:00Z', identity: { display_name: 'Maya Chen', email: 'maya.chen@example.com' }, source_locator: 'Gmail · thread msg-104 · attachment 1', extracted_text_status: 'extracted', evidence_provenance: 'Resume attachment supplied by authorized Gmail intake.' },
    { candidate_id: 'candidate-sam', source_id: 'outlook-source-221', source_provider: 'microsoft_outlook', message_or_attachment_locator: 'Outlook message · msg-221 / sam-okafor-resume.pdf', recruiter_review_required: true, duplicate_candidate_ids: [], parse_status: 'parsed', warnings: [], attachment_filename: 'sam-okafor-resume.pdf', attachment_id: 'attachment-221', message_id: 'msg-221', sender_email: 'sam.okafor@example.com', received_at: '2026-09-30T07:18:00Z', identity: { display_name: 'Sam Okafor', email: 'sam.okafor@example.com' }, source_locator: 'Outlook · message msg-221 · attachment 1', extracted_text_status: 'extracted', evidence_provenance: 'Resume attachment supplied by authorized Outlook intake.' },
  ],
  criteria: sampleCriteria,
  candidate_assessments: sampleAssessments,
  ranking_explanation: 'The ordering reflects weighted evidence from the approved criteria version. Maya Chen leads on direct strategy, systems, research, and B2B workflow evidence; the material distinction is uncertainty around direct people-management scope. A ranking is decision support, not an autonomous hiring decision.',
  material_tie_breakers: ['Direct evidence of B2B workflow ownership', 'Specificity of design-system governance evidence', 'Confidence in required-criterion coverage'],
  scheduling: {
    scheduling_workflow_status: 'options_ready', provider: 'both', scheduling_draft_id: 'draft-maya-portfolio-v1', application_id: 'application-maya-design', approval_state: 'pending', approval_reference: 'approval-ref-maya-portfolio',
    participants: [
      { participant_id: 'candidate-maya', display_name: 'Maya Chen', email: 'maya.chen@example.com', role: 'candidate', time_zone: 'America/Los_Angeles', calendar_id: 'candidate-entered-availability' },
      { participant_id: 'priya-recruiter', display_name: 'Priya Shah', email: 'priya@northstar.co', role: 'recruiter', time_zone: 'America/Los_Angeles', calendar_id: 'google-calendar-priya' },
      { participant_id: 'alex-manager', display_name: 'Alex Rivera', email: 'alex@northstar.co', role: 'hiring_manager', time_zone: 'America/New_York', calendar_id: 'microsoft-calendar-alex' },
    ],
    constraints: { interview_type: 'Portfolio interview', duration_minutes: 60, buffer_minutes: 15, date_range_start: '2026-10-06', date_range_end: '2026-10-09', working_hours_start: '09:00', working_hours_end: '16:00', time_zone: 'America/Los_Angeles', candidate_availability_source: 'recruiter_entered' },
    proposed_slots: [
      { slot_id: 'slot-google-1', start: '2026-10-06T10:30:00-07:00', end: '2026-10-06T11:30:00-07:00', time_zone: 'America/Los_Angeles', provider: 'google', calendar_ids_checked: ['google-calendar-priya', 'candidate-entered-availability'], participant_availability_confirmed: true, freshness: 'refreshed 1 minute ago', status: 'proposed' },
      { slot_id: 'slot-microsoft-1', start: '2026-10-06T10:30:00-07:00', end: '2026-10-06T11:30:00-07:00', time_zone: 'America/Los_Angeles', provider: 'microsoft', calendar_ids_checked: ['microsoft-calendar-alex', 'candidate-entered-availability'], participant_availability_confirmed: true, freshness: 'refreshed 1 minute ago', status: 'proposed' },
      { slot_id: 'slot-both-2', start: '2026-10-06T14:00:00-07:00', end: '2026-10-06T15:00:00-07:00', time_zone: 'America/Los_Angeles', provider: 'google', calendar_ids_checked: ['google-calendar-priya', 'microsoft-calendar-alex', 'candidate-entered-availability'], participant_availability_confirmed: true, freshness: 'refreshed 1 minute ago', status: 'proposed' },
    ],
    provider_options: [
      { provider: 'google', scheduling_draft_id: 'draft-maya-google-v1', approval_state: 'pending', requires_explicit_recruiter_approval: true, proposed_slots: [{ slot_id: 'slot-google-1', start: '2026-10-06T10:30:00-07:00', end: '2026-10-06T11:30:00-07:00', time_zone: 'America/Los_Angeles', provider: 'google', calendar_ids_checked: ['google-calendar-priya', 'candidate-entered-availability'], participant_availability_confirmed: true, freshness: 'refreshed 1 minute ago', status: 'proposed' }], selected_slot_id: 'slot-google-1', event_id: '', message_id: '', meeting_link: '', event_title: 'Portfolio interview — Maya Chen', message_preview: 'Draft only. Approval is required before an event or invitation is created.', warnings: [], freshness: 'refreshed 1 minute ago', audit_event_ids: ['audit-slot-google-1'] },
      { provider: 'microsoft', scheduling_draft_id: 'draft-maya-microsoft-v1', approval_state: 'pending', requires_explicit_recruiter_approval: true, proposed_slots: [{ slot_id: 'slot-microsoft-1', start: '2026-10-06T10:30:00-07:00', end: '2026-10-06T11:30:00-07:00', time_zone: 'America/Los_Angeles', provider: 'microsoft', calendar_ids_checked: ['microsoft-calendar-alex', 'candidate-entered-availability'], participant_availability_confirmed: true, freshness: 'refreshed 1 minute ago', status: 'proposed' }], selected_slot_id: 'slot-microsoft-1', event_id: '', message_id: '', meeting_link: '', event_title: 'Portfolio interview — Maya Chen', message_preview: 'Draft only. Approval is required before an event or invitation is created.', warnings: [], freshness: 'refreshed 1 minute ago', audit_event_ids: ['audit-slot-microsoft-1'] },
    ],
    selected_slot_id: 'slot-google-1', event_id: '', message_id: '', meeting_link: '', event_title: 'Portfolio interview — Maya Chen', message_preview: 'Draft only. Approval is required before an event or invitation is created.', warnings: [], audit_event_ids: ['audit-draft-maya-portfolio'], invitation_created: false, invitation_requires_explicit_recruiter_approval: true,
  },
  warnings: [],
  audit_event_ids: ['audit-ranking-v3', 'audit-criteria-v3'],
  recommended_next_action: 'human_decision',
  autonomous_rejection: false,
  recruiter_approval_reference: 'approval-ref-ranking-maya',
}

const sampleAuditRows: AuditRecord[] = [
  { id: 'audit-ranking-v3', actor_user_id: 'recruiter-priya', action: 'ranking_generated', entity_type: 'ranking_snapshot', entity_id: 'ranking-product-design-v3', details: { criteria_version_id: 'criteria-product-design-v3', candidates: 18, autonomous_rejection: false }, occurred_at: '2026-09-30T08:45:00Z' },
  { id: 'audit-criteria-v3', actor_user_id: 'recruiter-priya', action: 'criteria_approved', entity_type: 'job', entity_id: 'role-product-design', details: { version: 'v3', required: 3, preferred: 2 }, occurred_at: '2026-09-30T08:41:00Z' },
  { id: 'audit-intake-gmail', actor_user_id: 'recruiter-priya', action: 'inbox_sync_completed', entity_type: 'integration_connection', entity_id: 'integration-gmail', details: { source_provider: 'gmail', attachments_reviewed: 4 }, occurred_at: '2026-09-30T08:42:00Z' },
  { id: 'audit-slot-google-1', actor_user_id: 'recruiter-priya', action: 'slot_options_proposed', entity_type: 'interview_draft', entity_id: 'draft-maya-portfolio-v1', details: { provider: 'google', approval_state: 'pending', invitation_created: false }, occurred_at: '2026-09-30T08:44:00Z' },
]

function CriteriaEditor({ criteria, onChange, approvalState, onApprove, onGenerate, onSave, onDelete, busy }: { criteria: Criterion[]; onChange: (criteria: Criterion[]) => void; approvalState: 'approved' | 'pending' | 'changed_requires_reapproval'; onApprove: () => void; onGenerate: () => void; onSave: () => void; onDelete: (criterion: Criterion) => void; busy: boolean }) {
  const total = criteria.reduce((sum, item) => sum + Number(item.weight || 0), 0)
  const patch = (id: string, value: Partial<Criterion>) => onChange(criteria.map((item) => item.criterion_id === id ? { ...item, ...value, approved: false } : item))
  const add = () => onChange([...criteria, { criterion_id: `new-${Date.now()}`, label: '', criterion_type: 'required', minimum_match: 70, weight: 0, approved: false, job_relevance_note: '' }])
  return <Card className="border-border bg-card shadow-sm"><CardHeader className="border-b border-border/70 pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Review criteria & weights</CardTitle><CardDescription className="mt-1">Importance weights build the final ranking and total 100%. Minimum evidence match is an independent threshold for each skill.</CardDescription></div><div className="flex gap-2"><StatusBadge value={approvalState === 'approved' ? 'approved' : 'pending'} label={approvalState === 'approved' ? 'Criteria approved' : 'Approval required'} /><Badge variant="outline" className="rounded-full">{total}% total</Badge></div></div></CardHeader><CardContent className="p-0"><div className="divide-y divide-border/70">{criteria.length ? criteria.map((item) => <div key={item.criterion_id} className="space-y-3 p-4"><div className="grid gap-3 lg:grid-cols-[1fr_150px_130px_150px_auto]"><div><Label className="text-[10px] uppercase text-muted-foreground">Criterion</Label><Input value={item.label} onChange={(e) => patch(item.criterion_id,{label:e.target.value})} placeholder="Criterion name" className="rounded-lg" /></div><div><Label className="text-[10px] uppercase text-muted-foreground">Type</Label><Select value={item.criterion_type} onValueChange={(v) => patch(item.criterion_id,{criterion_type:v as CriteriaType})}><SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="required">Required</SelectItem><SelectItem value="preferred">Preferred</SelectItem><SelectItem value="disqualifying">Disqualifying</SelectItem><SelectItem value="contextual">Contextual</SelectItem></SelectContent></Select></div><div><Label className="text-[10px] uppercase text-muted-foreground">Importance weight</Label><Input type="number" min={0} max={100} value={item.weight} onChange={(e) => patch(item.criterion_id,{weight:Number(e.target.value)||0})} className="rounded-lg text-right" /></div><div><Label className="text-[10px] uppercase text-muted-foreground">Minimum evidence match</Label><Input type="number" min={0} max={100} value={item.minimum_match} onChange={(e) => patch(item.criterion_id,{minimum_match:Math.min(100,Math.max(0,Number(e.target.value)||0))})} className="rounded-lg text-right" /></div><Button type="button" variant="ghost" size="icon" onClick={() => onDelete(item)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button></div><Textarea value={item.job_relevance_note} onChange={(e) => patch(item.criterion_id,{job_relevance_note:e.target.value})} placeholder="Why is this relevant to job performance?" className="min-h-16 rounded-lg" /></div>) : <div className="p-8"><EmptyState title="No criteria yet" description="Generate a draft from the job description or add one manually." actionLabel="Generate from job description" onAction={onGenerate} /></div>}</div><div className="space-y-3 border-t border-border bg-muted/30 p-4"><div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onGenerate} disabled={busy}><Sparkles className="mr-2 h-4 w-4" />Generate</Button><Button type="button" variant="outline" onClick={add}><Plus className="mr-2 h-4 w-4" />Add criterion</Button><Button type="button" variant="outline" onClick={onSave} disabled={busy || !criteria.length}><FileCheck2 className="mr-2 h-4 w-4" />Save changes</Button></div><Button type="button" onClick={onApprove} disabled={busy || !criteria.length || total !== 100 || criteria.some((i)=>!i.label.trim()||!i.job_relevance_note.trim()) || approvalState === 'approved'}><Check className="mr-2 h-4 w-4" />Approve criteria</Button></div>{total !== 100 && <p className="text-xs text-amber-700">Importance weights must total 100%. Current total: {total}%. Minimum evidence match values are independent and are not added together.</p>}{total === 100 && <p className="text-xs text-muted-foreground">Importance weights total 100%. Each minimum evidence match is checked independently; for example Python 80% and AI 60%.</p>}</div></CardContent></Card>
}
function ResponseTrace({ data, metadata }: { data: OrchestratorData | null; metadata: AgentMetadata | null }) {
  if (!data) return null
  const scheduling = data.scheduling
  return <Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">Workflow trace</CardTitle><CardDescription className="mt-1">Machine-readable identifiers and guardrails returned by the orchestrator.</CardDescription></div><StatusBadge value={data.workflow_status} /></div></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Role', data.role_id], ['Assessment', data.assessment_id], ['Criteria version', data.criteria_version_id], ['Ranking snapshot', data.ranking_snapshot_id], ['Candidate', data.candidate_id], ['Approval reference', data.recruiter_approval_reference], ['Workflow status', data.workflow_status], ['Recommended next action', data.recommended_next_action]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-muted/50 p-3"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 break-words text-xs font-medium">{value}</p></div>)}</div><div className="grid gap-5 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold">Workflow warnings</p><WarningList warnings={Array.isArray(data.warnings) ? data.warnings : []} /></div><div><p className="mb-2 text-xs font-semibold">Audit event IDs</p><div className="flex flex-wrap gap-2">{Array.isArray(data.audit_event_ids) && data.audit_event_ids.length > 0 ? data.audit_event_ids.map((id) => <Badge key={id} variant="outline" className="font-mono text-[10px]">{id}</Badge>) : <span className="text-xs text-muted-foreground">No audit IDs returned.</span>}</div><div className="mt-4 grid gap-2 text-xs"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Recruiter attention</span><span className="font-medium">{data.item_requires_recruiter_attention ? 'Required' : 'Not required'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Autonomous rejection</span><span className="font-medium">{data.autonomous_rejection ? 'Not allowed' : 'Disabled'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Scheduling approval state</span><span className="font-medium">{scheduling?.approval_state ?? 'Not returned'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Invitation created</span><span className="font-medium">{scheduling?.invitation_created ? 'Yes' : 'No'}</span></div></div></div></div>{metadata && <div className="border-t border-border/70 pt-4"><div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground"><span>Agent: <strong className="font-medium text-foreground">{metadata.agent_name}</strong></span><span>Timestamp: <strong className="font-medium text-foreground">{metadata.timestamp}</strong></span><span>Sub-agents used: <strong className="font-medium text-foreground">{Array.isArray(metadata.sub_agents_used) && metadata.sub_agents_used.length > 0 ? metadata.sub_agents_used.join(', ') : 'None returned'}</strong></span></div></div>}</CardContent></Card>
}

function IntakeRecordList({ records }: { records: CandidateSourceRecord[] }) {
  if (!Array.isArray(records) || records.length === 0) return <EmptyState title="No intake matches yet" description="Sync an authorized inbox or upload a resume to create a reviewable source record." />
  return <div className="space-y-3">{records.map((record, index) => <div key={`${record.source_id}-${index}`} className="rounded-xl border border-border bg-background/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{record.identity?.display_name ?? record.candidate_id}</p><StatusBadge value={record.source_provider} label={record.source_provider === 'microsoft_outlook' ? 'Outlook' : record.source_provider === 'gmail' ? 'Gmail' : 'Direct upload'} /><StatusBadge value={record.parse_status} /></div><p className="mt-1 break-words text-xs text-muted-foreground">{record.message_or_attachment_locator}</p></div><Badge variant="outline" className={record.recruiter_review_required ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300' : ''}>{record.recruiter_review_required ? 'Review required' : 'Ready'}</Badge></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-muted-foreground">Source ID</p><p className="mt-1 break-words font-mono">{record.source_id}</p></div><div><p className="text-muted-foreground">Attachment</p><p className="mt-1 break-words">{record.attachment_filename ?? record.attachment_id ?? 'Not provided'}</p></div><div><p className="text-muted-foreground">Received</p><p className="mt-1">{parseDateLabel(record.received_at ?? '')}</p></div><div><p className="text-muted-foreground">Text / provenance</p><p className="mt-1">{record.extracted_text_status ?? 'Not provided'} · {record.evidence_provenance ?? 'No provenance returned'}</p></div></div><div className="mt-3 grid gap-3 border-t border-border/70 pt-3 text-xs sm:grid-cols-2"><div><p className="text-muted-foreground">Sender / message</p><p className="mt-1 break-words">{record.sender_email ?? 'Not provided'} · {record.message_id ?? 'No message ID'}</p><p className="mt-1 break-words text-muted-foreground">{record.source_locator ?? 'No source locator'}</p></div><div><p className="text-muted-foreground">Duplicate candidate IDs</p><p className="mt-1 break-words">{Array.isArray(record.duplicate_candidate_ids) && record.duplicate_candidate_ids.length > 0 ? record.duplicate_candidate_ids.join(', ') : 'None detected'}</p><p className="mt-1 text-muted-foreground">{record.warnings.length} warning(s)</p></div></div>{Array.isArray(record.warnings) && record.warnings.length > 0 && <div className="mt-3"><WarningList warnings={record.warnings} compact /></div>}</div>)}</div>
}

function RolesView({ jobs, criteriaRecords, selectedIds, onSelectionChange, onSelectAll, onOpenRole, onNewRole, onArchiveSelected, onDeleteSelected, actionBusy }: { jobs: JobRecord[]; criteriaRecords: CriteriaRecord[]; selectedIds: Set<string>; onSelectionChange: (id: string, checked: boolean) => void; onSelectAll: (checked: boolean, ids: string[]) => void; onOpenRole: (job: JobRecord, destination: 'overview' | 'criteria' | 'candidates' | 'intake' | 'activity') => void; onNewRole: () => void; onArchiveSelected: () => void; onDeleteSelected: () => void; actionBusy: boolean }) {
  const [query, setQuery] = useState('')
  const filtered = jobs.filter((job) => `${job.title} ${job.department} ${job.location}`.toLowerCase().includes(query.toLowerCase()))
  const realJobs = filtered.filter((job) => !job.id.startsWith('role-'))
  const allSelected = realJobs.length > 0 && realJobs.every((job) => selectedIds.has(job.id))
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace / role management</p><h1 className="mt-2 text-balance font-serif text-4xl tracking-tight">Roles</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create, archive, delete, and open job-specific criteria, candidates, intake, and activity.</p></div><Button type="button" onClick={onNewRole} className="rounded-xl"><Plus className="mr-2 h-4 w-4" />New role</Button></div><Card className="overflow-hidden border-border bg-card shadow-sm"><CardHeader className="border-b border-border/70 pb-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, departments, locations" className="rounded-xl pl-9" /></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onArchiveSelected} disabled={actionBusy || selectedIds.size === 0} className="rounded-xl"><Archive className="mr-2 h-4 w-4" />Archive selected</Button><Button type="button" variant="outline" onClick={onDeleteSelected} disabled={actionBusy || selectedIds.size === 0} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40">{actionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete selected{selectedIds.size ? ` (${selectedIds.size})` : ''}</Button></div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[960px] border-collapse text-left"><thead className="bg-muted/60"><tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Select all real roles" checked={allSelected} onChange={(event) => onSelectAll(event.target.checked, realJobs.map((job) => job.id))} className="h-4 w-4 rounded border-border accent-primary" /></th><th className="px-4 py-3 font-mono font-medium">Role</th><th className="px-4 py-3 font-mono font-medium">Status</th><th className="px-4 py-3 font-mono font-medium">Criteria</th><th className="px-4 py-3 font-mono font-medium">Location</th><th className="px-4 py-3 font-mono font-medium">Workspace</th></tr></thead><tbody>{filtered.map((job) => { const isSample = job.id.startsWith('role-'); const roleCriteria = criteriaRecords.filter((criterion) => criterion.job_id === job.id); const approved = roleCriteria.length > 0 && roleCriteria.every((criterion) => criterion.approved); return <tr key={job.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30"><td className="px-4 py-4"><input type="checkbox" aria-label={`Select ${job.title}`} checked={selectedIds.has(job.id)} disabled={isSample} onChange={(event) => onSelectionChange(job.id, event.target.checked)} className="h-4 w-4 rounded border-border accent-primary disabled:opacity-30" /></td><td className="px-4 py-4"><button type="button" onClick={() => onOpenRole(job, 'overview')} className="text-left"><p className="font-semibold hover:underline">{job.title}</p><p className="mt-1 text-xs text-muted-foreground">{job.department || 'Unassigned department'}{isSample ? ' · Sample' : ''}</p></button></td><td className="px-4 py-4"><StatusBadge value={job.status === 'archived' ? 'warning' : 'approved'} label={job.status} /></td><td className="px-4 py-4"><StatusBadge value={approved ? 'approved' : 'pending'} label={approved ? `${roleCriteria.length} approved` : roleCriteria.length ? 'Approval needed' : 'Not configured'} /></td><td className="px-4 py-4 text-sm text-muted-foreground">{job.location || 'Flexible'}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => onOpenRole(job, 'criteria')} className="h-8 rounded-lg text-xs">Criteria</Button><Button type="button" variant="ghost" size="sm" onClick={() => onOpenRole(job, 'candidates')} className="h-8 rounded-lg text-xs">Candidates</Button><Button type="button" variant="ghost" size="sm" onClick={() => onOpenRole(job, 'intake')} className="h-8 rounded-lg text-xs">Intake</Button><Button type="button" variant="ghost" size="sm" onClick={() => onOpenRole(job, 'activity')} className="h-8 rounded-lg text-xs">Activity</Button></div></td></tr>})}</tbody></table></div>{filtered.length === 0 && <div className="p-8"><EmptyState title="No roles found" description="Adjust your search or create a new role." actionLabel="Create role" onAction={onNewRole} /></div>}</CardContent></Card><div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground"><strong className="text-foreground">Role-specific flow:</strong> open a role → configure and approve its criteria → add resumes to that role → screen and rank only that role’s candidates → review activity.</div></div>
}

function JobsView({ jobs, candidates, integrations, criteria, criteriaApproval, onCriteriaChange, onApproveCriteria, criteriaBusy, onSelectJob, selectedJobId, onOpenCriteria, onOpenCandidates, onNewRole, onDeleteRole, deleteBusy, onUpload, uploadBusy, onSync, onReviewIntake, intakeRecords, intakeBusy, sampleData, onToggleSample, loading }: { jobs: JobRecord[]; candidates: CandidateRecord[]; integrations: IntegrationRecord[]; criteria: Criterion[]; criteriaApproval: 'approved' | 'pending' | 'changed_requires_reapproval'; onCriteriaChange: (criteria: Criterion[]) => void; onApproveCriteria: () => void; criteriaBusy: boolean; onSelectJob: (id: string) => void; selectedJobId: string; onOpenCriteria: () => void; onOpenCandidates: () => void; onNewRole: () => void; onDeleteRole: (job: JobRecord) => void; deleteBusy: boolean; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; uploadBusy: boolean; onSync: (provider: 'gmail' | 'outlook') => void; onReviewIntake: () => void; intakeRecords: CandidateSourceRecord[]; intakeBusy: boolean; sampleData: boolean; onToggleSample: (value: boolean) => void; loading: boolean }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0]
  const pendingCriteria = criteriaApproval === 'approved' ? 0 : 1
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace / roles</p><h1 className="mt-2 text-balance font-serif text-4xl tracking-tight">Jobs & intake</h1><p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Configure a role, collect resumes from authorized sources, and move only reviewed evidence into screening.</p></div><Button type="button" onClick={onNewRole} className="w-full rounded-xl active:scale-[0.98] sm:w-auto"><Plus className="mr-2 h-4 w-4" />New role</Button></div><MetricStrip jobs={jobs} candidates={candidates} integrations={integrations} pendingCriteria={pendingCriteria} /><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"><div className="flex items-center gap-3"><Switch id="sample-data-jobs" checked={sampleData} onCheckedChange={onToggleSample} /><Label htmlFor="sample-data-jobs" className="text-sm font-medium">Sample Data</Label><span className="text-xs text-muted-foreground">{sampleData ? 'Examples are visible alongside workspace records.' : 'Examples are hidden; real records remain.'}</span></div>{loading && <span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading workspace</span>}</div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]"><Card className="min-w-0 border-border bg-card shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/70 pb-4"><div><CardTitle className="text-base">Active roles</CardTitle><CardDescription className="mt-1">Select a role to review criteria and intake.</CardDescription></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={onOpenCriteria} className="rounded-lg"><SlidersHorizontal className="mr-2 h-3.5 w-3.5" />Criteria</Button>{selectedJob && !selectedJob.id.startsWith('role-') && <Button type="button" variant="outline" size="sm" onClick={() => onDeleteRole(selectedJob)} disabled={deleteBusy} className="rounded-lg border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40">{deleteBusy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}Delete role</Button>}</div></CardHeader><CardContent className="p-0">{jobs.length === 0 ? <div className="p-6"><EmptyState title="No roles in this view" description="Turn Sample Data on for examples or create your first role to start a reviewable intake workflow." actionLabel="Create role" onAction={onNewRole} /></div> : <div className="divide-y divide-border/70">{jobs.map((job) => <button type="button" key={job.id} onClick={() => onSelectJob(job.id)} className={`flex min-h-24 w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${job.id === selectedJobId ? 'bg-muted/50' : ''}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{job.title}</p><StatusBadge value={job.id === selectedJobId ? criteriaApproval : 'approved'} label={job.id === selectedJobId ? (criteriaApproval === 'approved' ? 'Criteria approved' : 'Review criteria') : 'Open'} /></div><p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{job.description || 'No description provided.'}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>{job.department || 'Unassigned department'}</span><span>·</span><span>{job.location || 'Location flexible'}</span><span>·</span><span>{candidates.length} candidate records</span></div></div><ChevronRight className={`mt-1 h-4 w-4 shrink-0 transition-transform ${job.id === selectedJobId ? 'translate-x-0.5 text-primary' : 'text-muted-foreground'}`} /></button>)}</div>}</CardContent></Card><Card className="min-w-0 border-border bg-card shadow-sm"><CardHeader className="pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Add candidates</CardTitle><CardDescription className="mt-1">{selectedJob?.title ?? 'Select a role first'}</CardDescription></div><StatusBadge value={criteriaApproval === 'approved' ? 'approved' : 'pending'} label={criteriaApproval === 'approved' ? 'Ready to screen' : 'Criteria pending'} /></div></CardHeader><CardContent className="space-y-5"><div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center"><Upload className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Drop resumes here</p><p className="mt-1 text-xs text-muted-foreground">PDF or DOCX · up to 20 files</p><input ref={fileInputRef} type="file" accept=".pdf,.docx" multiple className="sr-only" onChange={onUpload} /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy} className="mt-4 rounded-xl active:scale-[0.98]">{uploadBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{uploadBusy ? 'Processing resume…' : 'Browse files'}</Button><p className="mt-3 text-[11px] text-muted-foreground">Direct uploads are parsed for recruiter review before screening.</p></div><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Connected inboxes</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-3"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Gmail</p></div><p className="mt-2 truncate text-xs text-muted-foreground">recruiting@northstar.co</p><Button type="button" variant="outline" size="sm" onClick={() => onSync('gmail')} disabled={intakeBusy} className="mt-3 w-full rounded-lg">{intakeBusy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}Sync inbox</Button></div><div className="rounded-xl border border-border p-3"><div className="flex items-center gap-2"><Inbox className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Outlook</p></div><p className="mt-2 truncate text-xs text-muted-foreground">talent@northstar.co</p><Button type="button" variant="outline" size="sm" onClick={() => onSync('outlook')} disabled={intakeBusy} className="mt-3 w-full rounded-lg">{intakeBusy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}Sync inbox</Button></div></div></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3"><div><p className="text-sm font-semibold">{intakeRecords.length || 3} intake matches</p><p className="mt-1 text-xs text-muted-foreground">Review source provenance and duplicates before screening.</p></div><Button type="button" variant="outline" onClick={onReviewIntake} className="rounded-lg">Review queue</Button></div><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={onOpenCriteria} className="rounded-lg text-xs">Review criteria <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" onClick={onOpenCandidates} className="rounded-lg text-xs">Open ranking <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button></div></CardContent></Card></div>{intakeRecords.length > 0 && <Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Latest intake review queue</CardTitle><CardDescription className="mt-1">Every source stays attributable to its provider until a recruiter confirms it.</CardDescription></div><StatusBadge value="warning" label="Human review" /></div></CardHeader><CardContent><IntakeRecordList records={intakeRecords} /></CardContent></Card>}</div>
}

function CriteriaView({ roleTitle, criteria, approvalState, onChange, onApprove, onGenerate, onSave, onDelete, busy, data, onRerun, rerunBusy, onBackToRoles, onGoToIntake, onGoToCandidates }: { roleTitle: string; criteria: Criterion[]; approvalState: 'approved' | 'pending' | 'changed_requires_reapproval'; onChange: (criteria: Criterion[]) => void; onApprove: () => void; onGenerate: () => void; onSave: () => void; onDelete: (criterion: Criterion) => void; busy: boolean; data: OrchestratorData | null; onRerun: () => void; rerunBusy: boolean; onBackToRoles: () => void; onGoToIntake: () => void; onGoToCandidates: () => void }) {
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><button type="button" onClick={onBackToRoles} className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">Roles / {roleTitle || 'Select a role'} / Criteria</button><h1 className="mt-2 text-balance font-serif text-4xl tracking-tight">Criteria for {roleTitle || 'selected role'}</h1><p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Approve job-relevant criteria before any ranked assessment is produced. Protected or unrelated signals stay out.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onApprove} disabled={busy || criteria.length === 0 || approvalState === 'approved'} className="rounded-xl active:scale-[0.98]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Approve criteria</Button><Button type="button" onClick={onRerun} disabled={rerunBusy || approvalState !== 'approved'} className="rounded-xl active:scale-[0.98]">{rerunBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Rerun screening</Button></div></div><div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]"><CriteriaEditor criteria={criteria} onChange={onChange} approvalState={approvalState} onApprove={onApprove} onGenerate={onGenerate} onSave={onSave} onDelete={onDelete} busy={busy} /><Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Fairness guardrails</CardTitle><CardDescription className="mt-1">Visible controls for a reviewable screening run.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-medium">Job relevance only</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Names, photos, addresses, graduation years, and protected or proxy attributes are excluded from scoring.</p></div></div><div className="flex gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-medium">Missing is not no</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Missing evidence is shown as uncertainty, never as proof that a candidate lacks a skill.</p></div></div><div className="flex gap-3"><UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-medium">Recruiter owns the decision</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Every advance, hold, decline, or override requires a human-authored reason.</p></div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><strong>Approval state:</strong> {approvalState === 'approved' ? 'This version can be screened.' : 'Ranking is blocked until this version is approved.'}</div></CardContent></Card></div>{approvalState === 'approved' && <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="font-semibold">Criteria approved for {roleTitle}</p><p className="mt-1 text-sm text-muted-foreground">Next, add resumes in Intake. Once candidates are processed, open Candidates to run or review screening.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onGoToCandidates}>View candidates</Button><Button type="button" onClick={onGoToIntake}>Go to intake <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>}{data && <Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Orchestrator criteria response</CardTitle><CardDescription className="mt-1">Returned version `{data.criteria_version_id}` and workflow state `{data.workflow_status}`.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Role ID</p><p className="mt-1 break-words text-xs font-medium">{data.role_id}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Criteria version</p><p className="mt-1 break-words text-xs font-medium">{data.criteria_version_id}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Next action</p><p className="mt-1 break-words text-xs font-medium">{data.recommended_next_action}</p></div></div><div><p className="mb-2 text-xs font-semibold">Ranking explanation</p>{renderMarkdown(data.ranking_explanation)}</div><div><p className="mb-2 text-xs font-semibold">Material tie-breakers</p><div className="space-y-2">{Array.isArray(data.material_tie_breakers) && data.material_tie_breakers.length > 0 ? data.material_tie_breakers.map((item, index) => <div key={`${item}-${index}`} className="flex gap-2 text-sm"><span className="font-mono text-xs text-muted-foreground">0{index + 1}</span><span>{item}</span></div>) : <p className="text-xs text-muted-foreground">No tie-breakers returned.</p>}</div></div></CardContent></Card>}</div>
}

function ScoreBar({ score }: { score: number }) {
  return <div className="flex gap-1" aria-label={`${score} out of 4`}><span className={`h-1.5 flex-1 rounded-full ${score >= 1 ? 'bg-primary' : 'bg-muted'}`} /><span className={`h-1.5 flex-1 rounded-full ${score >= 2 ? 'bg-primary' : 'bg-muted'}`} /><span className={`h-1.5 flex-1 rounded-full ${score >= 3 ? 'bg-primary' : 'bg-muted'}`} /><span className={`h-1.5 flex-1 rounded-full ${score >= 4 ? 'bg-primary' : 'bg-muted'}`} /></div>
}

function CandidateDrawer({ assessment, candidate, criteria, onDisposition, dispositionReason, onReasonChange, dispositionBusy }: { assessment: CandidateAssessment | undefined; candidate: CandidateRecord | undefined; criteria: Criterion[]; onDisposition: (action: 'advance' | 'hold' | 'decline') => void; dispositionReason: string; onReasonChange: (value: string) => void; dispositionBusy: boolean }) {
  if (!assessment) return <EmptyState title="Select a candidate" description="Choose a ranking row to inspect criterion-level evidence, uncertainty, and recruiter actions." />
  return <div className="space-y-5"><div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge value={assessment.confidence >= 0.85 ? 'approved' : 'warning'} label={`${Math.round(assessment.confidence * 100)}% confidence`} /><Badge variant="outline" className="rounded-full">Rank {String(assessment.rank_position).padStart(2, '0')}</Badge></div><h2 className="mt-3 text-xl font-semibold">{candidate?.full_name ?? assessment.candidate_id}</h2><p className="mt-1 break-words text-xs text-muted-foreground">{candidate?.email ?? 'Email not returned'} · {candidate?.phone ?? 'Phone not returned'}</p></div><Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-lg" title="More candidate actions"><MoreHorizontal className="h-4 w-4" /></Button></div><div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Overall score</p><p className="mt-1 font-serif text-3xl tabular-nums">{assessment.overall_score}<span className="font-sans text-sm text-muted-foreground">/100</span></p></div><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Required coverage</p><p className="mt-1 font-serif text-3xl tabular-nums">{Math.round(assessment.required_criteria_coverage * 100)}<span className="font-sans text-sm text-muted-foreground">%</span></p></div></div><div><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold">Criterion evidence</p><span className="text-xs text-muted-foreground">Assessment {assessment.assessment_id}</span></div><div className="space-y-3">{Array.isArray(assessment.criterion_scores) && assessment.criterion_scores.map((score) => <div key={score.criterion_id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-medium">{criteria.find((item) => item.criterion_id === score.criterion_id)?.label ?? score.criterion_id}</p><p className="mt-1 text-xs text-muted-foreground">Evidence match {Math.round((score.score / 4) * 100)}% · minimum {criteria.find((item) => item.criterion_id === score.criterion_id)?.minimum_match ?? 0}% · {Math.round(score.confidence * 100)}% confidence</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className={Math.round((score.score / 4) * 100) >= (criteria.find((item) => item.criterion_id === score.criterion_id)?.minimum_match ?? 0) ? 'rounded-full border-emerald-200 text-emerald-700' : 'rounded-full border-amber-200 text-amber-700'}>{Math.round((score.score / 4) * 100) >= (criteria.find((item) => item.criterion_id === score.criterion_id)?.minimum_match ?? 0) ? 'Threshold met' : 'Below threshold — human review'}</Badge><Badge variant="outline" className={score.missing_evidence ? 'rounded-full border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300' : 'rounded-full'}>{score.missing_evidence ? 'Missing evidence' : 'Evidence found'}</Badge></div></div><div className="mt-3"><ScoreBar score={score.score} /></div>{Array.isArray(score.evidence_excerpts) && score.evidence_excerpts.length > 0 ? <div className="mt-3 space-y-2">{score.evidence_excerpts.map((excerpt, index) => <div key={`${excerpt.source_id}-${index}`} className="rounded-lg border-l-2 border-primary bg-muted/50 p-3 text-xs leading-5"><p>“{excerpt.quote}”</p><p className="mt-2 font-mono text-[10px] text-muted-foreground">{excerpt.source_id} · {excerpt.locator}</p></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No evidence excerpt returned; this remains uncertain, not a definitive gap.</p>}<div className="mt-3 space-y-2 text-xs"><div><span className="font-medium">Reasoning:</span> {renderMarkdown(score.reasoning)}</div><div><span className="font-medium">Uncertainty:</span> {score.uncertainty}</div><div className="flex flex-wrap gap-3 text-muted-foreground"><span>Protected attributes excluded: {score.protected_attribute_excluded ? 'Yes' : 'No'}</span><span>Missing evidence: {score.missing_evidence ? 'Yes' : 'No'}</span></div></div></div>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-xs font-semibold">Strengths</p><div className="space-y-1.5">{Array.isArray(assessment.strengths) && assessment.strengths.length > 0 ? assessment.strengths.map((item) => <div key={item} className="flex gap-2 text-xs"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>{item}</span></div>) : <p className="text-xs text-muted-foreground">No strengths returned.</p>}</div></div><div><p className="mb-2 text-xs font-semibold">Gaps</p><div className="space-y-1.5">{Array.isArray(assessment.gaps) && assessment.gaps.length > 0 ? assessment.gaps.map((item) => <div key={item} className="flex gap-2 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /><span>{item}</span></div>) : <p className="text-xs text-muted-foreground">No gaps returned.</p>}</div></div></div><div><p className="mb-2 text-xs font-semibold">Assessment warnings</p><WarningList warnings={Array.isArray(assessment.warnings) ? assessment.warnings : []} compact /></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Human disposition required</p><p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">This recommendation is {assessment.recommended_next_action.replaceAll('_', ' ')}. It never rejects a candidate autonomously.</p><Label htmlFor="disposition-reason" className="mt-3 block text-xs font-medium text-amber-900 dark:text-amber-200">Recruiter reason</Label><Textarea id="disposition-reason" value={dispositionReason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Write the evidence-based reason for your decision…" className="mt-1 min-h-20 rounded-lg border-amber-200 bg-background text-foreground" /><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => onDisposition('hold')} disabled={dispositionBusy} className="rounded-lg">Hold</Button><Button type="button" variant="outline" onClick={() => onDisposition('decline')} disabled={dispositionBusy} className="rounded-lg">Decline</Button><Button type="button" onClick={() => onDisposition('advance')} disabled={dispositionBusy} className="rounded-lg">{dispositionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}Advance for human review</Button></div></div></div>
}

function CandidatesView({ roleTitle, criteria, assessments, candidates, selectedCandidateId, onSelectCandidate, selectedAssessment, onDisposition, dispositionReason, onReasonChange, dispositionBusy, onRemoveFromRole, onDeletePermanently, candidateActionBusy, loading, data, onEditCriteria, onRerun, rerunBusy, filters, onFilterChange }: { roleTitle: string; criteria: Criterion[]; assessments: CandidateAssessment[]; candidates: CandidateRecord[]; selectedCandidateId: string; onSelectCandidate: (id: string) => void; selectedAssessment: CandidateAssessment | undefined; onDisposition: (action: 'advance' | 'hold' | 'decline') => void; dispositionReason: string; onReasonChange: (value: string) => void; dispositionBusy: boolean; onRemoveFromRole: () => void; onDeletePermanently: () => void; candidateActionBusy: boolean; loading: boolean; data: OrchestratorData | null; onEditCriteria: () => void; onRerun: () => void; rerunBusy: boolean; filters: { stage: string; source: string; score: string }; onFilterChange: (key: 'stage' | 'source' | 'score', value: string) => void }) {
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const filteredAssessments = assessments.filter((assessment) => { const candidate = candidateMap.get(assessment.candidate_id); const stageMatch = filters.stage === 'all' || (filters.stage === 'review' ? assessment.recommended_next_action === 'review_evidence' || assessment.recommended_next_action === 'advance_for_human_review' : assessment.recommended_next_action === 'hold_for_more_information'); const sourceMatch = filters.source === 'all' || candidate?.source === filters.source; const scoreMatch = filters.score === 'all' || (filters.score === 'high' && assessment.overall_score >= 85) || (filters.score === 'review' && assessment.overall_score < 85); return stageMatch && sourceMatch && scoreMatch })
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Roles / {roleTitle || 'Select a role'} / Candidates</p><h1 className="mt-2 text-balance font-serif text-4xl tracking-tight">{roleTitle || 'Role'} candidate ranking</h1><p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Showing only applications attached to {roleTitle || 'the selected role'}. Compare resume evidence against this role’s approved criteria.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onEditCriteria} className="rounded-xl"><SlidersHorizontal className="mr-2 h-4 w-4" />Edit criteria</Button><Button type="button" onClick={onRerun} disabled={rerunBusy} className="rounded-xl active:scale-[0.98]">{rerunBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Rerun screening</Button></div></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.46fr)]"><div className="min-w-0 space-y-4"><div className="flex flex-wrap gap-2"><Select value={filters.stage} onValueChange={(value) => onFilterChange('stage', value)}><SelectTrigger className="h-10 w-full rounded-lg sm:w-40"><SelectValue placeholder="All stages" /></SelectTrigger><SelectContent><SelectItem value="all">All review states</SelectItem><SelectItem value="review">Needs review</SelectItem><SelectItem value="hold">Hold for info</SelectItem></SelectContent></Select><Select value={filters.score} onValueChange={(value) => onFilterChange('score', value)}><SelectTrigger className="h-10 w-full rounded-lg sm:w-36"><SelectValue placeholder="Score" /></SelectTrigger><SelectContent><SelectItem value="all">All scores</SelectItem><SelectItem value="high">85+ score</SelectItem><SelectItem value="review">Below 85</SelectItem></SelectContent></Select><Select value={filters.source} onValueChange={(value) => onFilterChange('source', value)}><SelectTrigger className="h-10 w-full rounded-lg sm:w-44"><SelectValue placeholder="Source" /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem><SelectItem value="gmail">Gmail</SelectItem><SelectItem value="microsoft_outlook">Outlook</SelectItem><SelectItem value="direct_upload">Direct upload</SelectItem></SelectContent></Select><Button type="button" variant="outline" className="h-10 rounded-lg"><Filter className="mr-2 h-3.5 w-3.5" />Missing requirements</Button></div><Card className="overflow-hidden border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="bg-muted/60"><tr className="border-b border-border/70 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-4 py-3 font-mono font-medium">Rank</th><th className="px-4 py-3 font-mono font-medium">Candidate</th><th className="px-4 py-3 font-mono font-medium">Score</th><th className="px-4 py-3 font-mono font-medium">Required</th><th className="px-4 py-3 font-mono font-medium">Confidence</th><th className="px-4 py-3 font-mono font-medium">Review state</th></tr></thead><tbody>{loading ? (<tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading candidates for {roleTitle}…</td></tr>) : filteredAssessments.length > 0 ? filteredAssessments.map((assessment) => { const candidate = candidateMap.get(assessment.candidate_id); const selected = assessment.candidate_id === selectedCandidateId; return <tr key={assessment.assessment_id} className={`cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40 ${selected ? 'bg-muted/60' : ''}`} onClick={() => onSelectCandidate(assessment.candidate_id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectCandidate(assessment.candidate_id) }}><td className="px-4 py-4 font-mono text-sm tabular-nums">{String(assessment.rank_position).padStart(2, '0')}</td><td className="px-4 py-4"><div className="flex min-w-44 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{(candidate?.full_name ?? assessment.candidate_id).split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{candidate?.full_name ?? assessment.candidate_id}</p><p className="mt-1 truncate text-xs text-muted-foreground">{candidate?.source ?? 'source not returned'} · {assessment.source_ids.join(', ')}</p></div></div></td><td className="px-4 py-4"><span className="font-serif text-2xl tabular-nums">{assessment.overall_score}</span><span className="text-xs text-muted-foreground"> /100</span></td><td className="px-4 py-4"><StatusBadge value={assessment.required_criteria_coverage >= 1 ? 'approved' : 'warning'} label={`${Math.round(assessment.required_criteria_coverage * 5)} of 5`} /></td><td className="px-4 py-4 text-sm">{Math.round(assessment.confidence * 100)}%</td><td className="px-4 py-4"><StatusBadge value={assessment.recommended_next_action === 'hold_for_more_information' ? 'warning' : 'approved'} label={assessment.recommended_next_action.replaceAll('_', ' ')} /></td></tr> }) : <tr><td colSpan={6} className="p-8"><EmptyState title="No candidates match these filters" description="Adjust the review state, score, or source filters. Real records remain available when Sample Data is off." /></td></tr>}</tbody></table></div></Card><p className="text-xs leading-5 text-muted-foreground">Scores summarize resume evidence against this role’s approved criteria. They are not hiring decisions and never trigger automatic rejection.</p>{data && <Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Ranking explanation</CardTitle><CardDescription className="mt-1">Snapshot `{data.ranking_snapshot_id}` · criteria `{data.criteria_version_id}`</CardDescription></CardHeader><CardContent className="space-y-4"><div>{renderMarkdown(data.ranking_explanation)}</div><div><p className="mb-2 text-xs font-semibold">Tie-breakers</p><div className="flex flex-wrap gap-2">{Array.isArray(data.material_tie_breakers) && data.material_tie_breakers.map((item) => <Badge key={item} variant="outline" className="rounded-full">{item}</Badge>)}</div></div></CardContent></Card>}</div><Card className="min-w-0 border-border bg-card shadow-sm"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">Evidence drawer</CardTitle><CardDescription className="mt-1">Selected candidate detail</CardDescription></div><Badge variant="outline" className="rounded-full"><FileCheck2 className="mr-1.5 h-3 w-3" />Cited</Badge></div></CardHeader><CardContent><CandidateDrawer assessment={selectedAssessment} candidate={candidateMap.get(selectedCandidateId)} criteria={criteria} onDisposition={onDisposition} dispositionReason={dispositionReason} onReasonChange={onReasonChange} dispositionBusy={dispositionBusy} /><div className="mt-4 grid gap-2"><Button type="button" variant="outline" onClick={onRemoveFromRole} disabled={candidateActionBusy || !selectedAssessment} className="rounded-lg">Remove from this role</Button><Button type="button" variant="outline" onClick={onDeletePermanently} disabled={candidateActionBusy || !selectedAssessment} className="rounded-lg border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300">{candidateActionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete candidate permanently</Button></div></CardContent></Card></div></div>
}

function SlotRow({ slot, selected, onSelect }: { slot: SlotOption; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`grid w-full gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:bg-muted/40'}`}><div><p className="font-serif text-xl tabular-nums">{slot.start.split('T')[1]?.slice(0, 5) ?? 'Time'}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{slot.time_zone}</p></div><div className="min-w-0"><p className="text-sm font-semibold">{selected ? 'Selected draft slot' : 'Available'}</p><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{parseDateLabel(slot.start)} → {parseDateLabel(slot.end)} · {slot.participant_availability_confirmed ? 'All participants free' : 'Availability needs review'}</p><p className="mt-1 text-[10px] text-muted-foreground">{slot.freshness} · checked {Array.isArray(slot.calendar_ids_checked) ? slot.calendar_ids_checked.join(', ') : 'No calendar IDs returned'}</p></div><StatusBadge value={slot.provider === 'google' ? 'approved' : 'warning'} label={slot.provider === 'google' ? 'Google' : 'Microsoft'} /></button>
}

function SchedulingDetails({ scheduling }: { scheduling: Scheduling }) {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Draft ID</p><p className="mt-1 break-words text-xs font-medium">{scheduling.scheduling_draft_id}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Application ID</p><p className="mt-1 break-words text-xs font-medium">{scheduling.application_id}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Event ID</p><p className="mt-1 break-words text-xs font-medium">{scheduling.event_id || 'Not created before approval'}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Message ID</p><p className="mt-1 break-words text-xs font-medium">{scheduling.message_id || 'Not sent before approval'}</p></div></div><div><p className="mb-2 text-xs font-semibold">Participants</p><div className="space-y-2">{Array.isArray(scheduling.participants) && scheduling.participants.map((participant) => <div key={participant.participant_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"><div><p className="font-medium">{participant.display_name} <span className="text-muted-foreground">· {participant.role}</span></p><p className="mt-1 break-words text-muted-foreground">{participant.email} · {participant.calendar_id}</p></div><Badge variant="outline" className="rounded-full">{participant.time_zone}</Badge></div>)}</div></div><div><p className="mb-2 text-xs font-semibold">Constraints</p><div className="grid gap-2 text-xs sm:grid-cols-2"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Interview type</span><span className="font-medium">{scheduling.constraints.interview_type}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Duration</span><span className="font-medium">{scheduling.constraints.duration_minutes} min</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Buffer</span><span className="font-medium">{scheduling.constraints.buffer_minutes} min</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Date range</span><span className="font-medium">{scheduling.constraints.date_range_start} → {scheduling.constraints.date_range_end}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Working hours</span><span className="font-medium">{scheduling.constraints.working_hours_start}–{scheduling.constraints.working_hours_end}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Time zone</span><span className="font-medium">{scheduling.constraints.time_zone}</span></div><div className="flex justify-between gap-3 sm:col-span-2"><span className="text-muted-foreground">Candidate availability source</span><span className="font-medium">{scheduling.constraints.candidate_availability_source}</span></div></div></div><div><p className="mb-2 text-xs font-semibold">Provider options</p><div className="space-y-2">{Array.isArray(scheduling.provider_options) && scheduling.provider_options.map((option) => <div key={option.scheduling_draft_id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{option.provider === 'google' ? 'Google Calendar' : 'Microsoft Calendar'}</p><StatusBadge value={option.approval_state} label={`Approval: ${option.approval_state}`} /></div><p className="mt-2 text-xs text-muted-foreground">{option.message_preview}</p><p className="mt-2 break-words font-mono text-[10px] text-muted-foreground">Draft {option.scheduling_draft_id} · selected {option.selected_slot_id || 'none'} · freshness {option.freshness}</p><p className="mt-2 break-words text-[10px] text-muted-foreground">Event {option.event_id || 'not created'} · message {option.message_id || 'not sent'} · link {option.meeting_link || 'not created'}</p><div className="mt-2 flex flex-wrap gap-1.5">{Array.isArray(option.audit_event_ids) && option.audit_event_ids.map((id) => <Badge key={id} variant="outline" className="font-mono text-[9px]">{id}</Badge>)}</div><div className="mt-3"><WarningList warnings={Array.isArray(option.warnings) ? option.warnings : []} compact /></div></div>)}</div></div><div className="rounded-xl border border-border bg-muted/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">Final event preview</p><p className="mt-1 text-xs text-muted-foreground">{scheduling.event_title}</p></div><StatusBadge value={scheduling.approval_state} label={`Approval ${scheduling.approval_state}`} /></div><p className="mt-3 text-sm leading-6">{scheduling.message_preview}</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><span className="text-muted-foreground">Meeting link:</span> {scheduling.meeting_link || 'Created after approval'}</div><div><span className="text-muted-foreground">Selected slot:</span> {scheduling.selected_slot_id || 'None'}</div><div><span className="text-muted-foreground">Invitation created:</span> {scheduling.invitation_created ? 'Yes' : 'No — draft only'}</div><div><span className="text-muted-foreground">Explicit approval:</span> {scheduling.invitation_requires_explicit_recruiter_approval ? 'Required' : 'Not required'}</div></div></div><div><p className="mb-2 text-xs font-semibold">Scheduling warnings</p><WarningList warnings={Array.isArray(scheduling.warnings) ? scheduling.warnings : []} /></div><div><p className="mb-2 text-xs font-semibold">Scheduling audit IDs</p><div className="flex flex-wrap gap-2">{Array.isArray(scheduling.audit_event_ids) && scheduling.audit_event_ids.length > 0 ? scheduling.audit_event_ids.map((id) => <Badge key={id} variant="outline" className="font-mono text-[10px]">{id}</Badge>) : <span className="text-xs text-muted-foreground">No audit IDs returned.</span>}</div></div></div>
}

function InterviewsView({ data, selectedProvider, onProviderChange, selectedSlotId, onSelectSlot, onRefresh, onApprove, busy, onEditConstraints }: { data: OrchestratorData | null; selectedProvider: Provider; onProviderChange: (provider: Provider) => void; selectedSlotId: string; onSelectSlot: (id: string) => void; onRefresh: () => void; onApprove: () => void; busy: boolean; onEditConstraints: () => void }) {
  const scheduling = data?.scheduling ?? sampleOrchestratorData.scheduling
  const candidate = data?.candidate_identity ?? sampleOrchestratorData.candidate_identity
  const visibleSlots = Array.isArray(scheduling.proposed_slots) ? scheduling.proposed_slots.filter((slot) => selectedProvider === 'both' || slot.provider === selectedProvider) : []
  const selectedSlot = visibleSlots.find((slot) => slot.slot_id === selectedSlotId) ?? visibleSlots[0]
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Interviews / draft</p><h1 className="mt-2 text-balance font-serif text-4xl tracking-tight">Coordinate interview</h1><p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Availability is checked across authorized calendars. A recommendation remains a draft until you explicitly approve sending.</p></div><Button type="button" variant="outline" onClick={onRefresh} disabled={busy} className="w-full rounded-xl sm:w-auto">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh availability</Button></div><div className="grid gap-5 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]"><Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{candidate.display_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div className="min-w-0"><CardTitle className="truncate text-base">{candidate.display_name}</CardTitle><CardDescription className="mt-1 truncate">{candidate.email} · Portfolio interview</CardDescription></div></div></CardHeader><CardContent className="space-y-0"><div className="divide-y divide-border/70">{[['DURATION', `${scheduling.constraints.duration_minutes} minutes`], ['DATE RANGE', `${scheduling.constraints.date_range_start} → ${scheduling.constraints.date_range_end}`], ['CANDIDATE TIME ZONE', scheduling.constraints.time_zone], ['WORKING HOURS', `${scheduling.constraints.working_hours_start}–${scheduling.constraints.working_hours_end}`], ['BUFFER', `${scheduling.constraints.buffer_minutes} minutes`]].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 py-4 text-sm"><span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>)}</div><div className="py-4"><p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Participants</p><div className="mt-3 flex flex-wrap gap-2">{Array.isArray(scheduling.participants) && scheduling.participants.map((participant) => <Badge key={participant.participant_id} variant="outline" className="rounded-full">{participant.display_name} · {participant.time_zone}</Badge>)}</div></div><Button type="button" variant="outline" onClick={onEditConstraints} className="mt-2 w-full rounded-xl">Edit constraints</Button></CardContent></Card><Card className="min-w-0 border-border bg-card shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Recommended times</CardTitle><CardDescription className="mt-1">{visibleSlots.length} openings · {scheduling.provider} provider context · {scheduling.proposed_slots[0]?.freshness ?? 'freshness not returned'}</CardDescription></div><Select value={selectedProvider} onValueChange={(value) => onProviderChange(value as Provider)}><SelectTrigger className="h-10 w-full rounded-lg sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Google + Microsoft</SelectItem><SelectItem value="google">Google Calendar</SelectItem><SelectItem value="microsoft">Microsoft Calendar</SelectItem></SelectContent></Select></div></CardHeader><CardContent className="space-y-3">{visibleSlots.length > 0 ? visibleSlots.map((slot) => <SlotRow key={slot.slot_id} slot={slot} selected={slot.slot_id === (selectedSlot?.slot_id ?? selectedSlotId)} onSelect={() => onSelectSlot(slot.slot_id)} />) : <EmptyState title="No fresh openings" description="Refresh availability or adjust the recruiter-entered constraints. Stale options are never sent." actionLabel="Refresh availability" onAction={onRefresh} />}<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{selectedSlot ? `${parseDateLabel(selectedSlot.start)} → ${parseDateLabel(selectedSlot.end)}` : 'Select a slot to continue'}</p><p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">Draft only · event and invitations have not been created.</p></div><Button type="button" onClick={onApprove} disabled={busy || !selectedSlot || scheduling.approval_state !== 'pending'} className="w-full rounded-xl bg-primary text-primary-foreground active:scale-[0.98] sm:w-auto">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Approve & send</Button></div></div><p className="text-xs leading-5 text-muted-foreground">Final approval creates the provider event and dispatches invitations to the displayed participants. If availability changes, the draft becomes stale and must be refreshed.</p></CardContent></Card></div><Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Scheduling response details</CardTitle><CardDescription className="mt-1">Provider state, participants, constraints, options, and audit IDs.</CardDescription></CardHeader><CardContent><SchedulingDetails scheduling={scheduling} /></CardContent></Card></div>
}

function IntegrationsView({ integrations, onSync, syncBusy }: { integrations: IntegrationRecord[]; onSync: (provider: 'gmail' | 'outlook') => void; syncBusy: boolean }) {
  return <div className="space-y-6"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sources / provider health</p><h1 className="mt-2 text-balance font-serif text-4xl tracking-tight">Integrations</h1><p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Platform authorization is already configured. These controls invoke provider actions or display their current health; they do not create OAuth flows.</p></div><div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-sm font-semibold">Provider health</p><p className="text-xs text-muted-foreground">{integrations.filter((item) => item.status === 'healthy').length} of {integrations.length} connections healthy</p></div></div><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Minimum scopes in use</Badge></div></div>{integrations.length === 0 ? <EmptyState title="No connections returned" description="The integration health endpoint did not return records. Check the authenticated data connection and retry." /> : <div className="grid gap-4 md:grid-cols-2">{integrations.map((integration) => { const providerLabel = integration.provider === 'microsoft_outlook' ? 'Microsoft Outlook' : integration.provider === 'microsoft_calendar' ? 'Microsoft Calendar' : integration.provider === 'googlecalendar' ? 'Google Calendar' : 'Gmail'; const isInbox = integration.provider === 'gmail' || integration.provider === 'microsoft_outlook'; return <Card key={integration.id} className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">{integration.provider.includes('calendar') ? <CalendarDays className="h-5 w-5" /> : <Mail className="h-5 w-5" />}</div><div><CardTitle className="text-base">{providerLabel}</CardTitle><CardDescription className="mt-1">{integration.account_email || 'Account not returned'}</CardDescription></div></div><StatusBadge value={integration.status} label={integration.status === 'healthy' ? 'Healthy' : integration.status} /></div></CardHeader><CardContent><div className="space-y-2 text-xs"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Connection ID</span><span className="break-all text-right font-mono">{integration.id}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Connected</span><span className="text-right">{parseDateLabel(integration.connected_at)}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Last synced</span><span className="text-right">{parseDateLabel(integration.last_synced_at)}</span></div></div>{isInbox && <Button type="button" variant="outline" onClick={() => onSync(integration.provider === 'gmail' ? 'gmail' : 'outlook')} disabled={syncBusy} className="mt-4 w-full rounded-xl">{syncBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sync {providerLabel}</Button>}<div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Provider controls are approval-aware.</div></CardContent></Card> })}</div>}<Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Integration safety</CardTitle><CardDescription className="mt-1">Why HireFlow shows provider state instead of connection setup.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div className="flex gap-3"><Globe2 className="h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-5">Gmail, Outlook, and calendars use authorized live context.</p></div><div className="flex gap-3"><Lock className="h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-5">Only the narrowest requested inbox and calendar scopes are used.</p></div><div className="flex gap-3"><CalendarClock className="h-5 w-5 shrink-0 text-primary" /><p className="text-xs leading-5">Calendar events and invitations require explicit approval.</p></div></CardContent></Card></div>
}

function AuditView({ auditRows, data }: { auditRows: AuditRecord[]; data: OrchestratorData | null }) {
  const rows = auditRows.length > 0 ? auditRows : []
  return <div className="space-y-6"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Governance / traceability</p><h1 className="mt-2 text-balance font-serif text-4xl tracking-tight">Audit log</h1><p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">Review automated activity, recruiter decisions, provider actions, and the state of every approval gate.</p></div><Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Recent events</CardTitle><CardDescription className="mt-1">Organization-scoped audit records, newest first.</CardDescription></div><Button type="button" variant="outline" className="rounded-lg"><Filter className="mr-2 h-3.5 w-3.5" />Filter events</Button></div></CardHeader><CardContent className="p-0">{rows.length === 0 ? <div className="p-6"><EmptyState title="No audit events returned" description="Once a recruiter approves criteria, advances a candidate, or approves a slot, the action appears here." /></div> : <div className="divide-y divide-border/70">{rows.map((row) => <div key={row.id} className="grid gap-3 p-5 lg:grid-cols-[160px_minmax(0,1fr)_minmax(200px,0.8fr)] lg:items-start"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{parseDateLabel(row.occurred_at)}</div><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{row.action.replaceAll('_', ' ')}</p><Badge variant="outline" className="rounded-full">{row.entity_type}</Badge></div><p className="mt-1 break-words font-mono text-[10px] text-muted-foreground">{row.id} · entity {row.entity_id}</p></div><div className="rounded-lg bg-muted/50 p-3 text-xs leading-5"><p className="font-medium">Event details</p><div className="mt-1 space-y-1">{Object.entries(row.details).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><span className="text-muted-foreground">{key.replaceAll('_', ' ')}</span><span className="break-words text-right">{typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'Structured detail'}</span></div>)}</div></div></div>)}</div>}</CardContent></Card>{data && <Card className="border-border bg-card shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">Current orchestrator audit references</CardTitle><CardDescription className="mt-1">The latest response is linked to these event IDs.</CardDescription></CardHeader><CardContent><div className="flex flex-wrap gap-2">{Array.isArray(data.audit_event_ids) && data.audit_event_ids.map((id) => <Badge key={id} variant="outline" className="font-mono text-[10px]">{id}</Badge>)}</div><div className="mt-4"><p className="mb-2 text-xs font-semibold">Scheduling references</p><div className="flex flex-wrap gap-2">{Array.isArray(data.scheduling?.audit_event_ids) && data.scheduling.audit_event_ids.map((id) => <Badge key={id} variant="outline" className="font-mono text-[10px]">{id}</Badge>)}</div></div></CardContent></Card>}</div>
}

function BulkDeleteRolesPanel({ jobs, onCancel, onConfirm, busy }: { jobs: JobRecord[]; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return <Card role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-title" className="border-red-200 bg-card shadow-md dark:border-red-900"><CardHeader className="pb-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"><Trash2 className="h-4 w-4" /></div><div><CardTitle id="bulk-delete-title" className="text-base">Delete {jobs.length} selected role{jobs.length === 1 ? '' : 's'}?</CardTitle><CardDescription className="mt-1 leading-5">This permanently deletes the selected roles and their linked recruitment records. Use Archive instead when hiring is complete.</CardDescription></div></div></CardHeader><CardContent><div className="max-h-32 space-y-1 overflow-auto rounded-xl bg-muted/40 p-3 text-sm">{jobs.map((job) => <p key={job.id}>{job.title}</p>)}</div><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="rounded-xl">Cancel</Button><Button type="button" onClick={onConfirm} disabled={busy} className="rounded-xl bg-red-700 text-white hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete {jobs.length} role{jobs.length === 1 ? '' : 's'}</Button></div></CardContent></Card>
}

function DeleteRolePanel({ job, onCancel, onConfirm, busy }: { job: JobRecord; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  const [confirmation, setConfirmation] = useState('')
  const confirmed = confirmation.trim() === job.title
  return <Card role="alertdialog" aria-modal="true" aria-labelledby="delete-role-title" className="border-red-200 bg-card shadow-md dark:border-red-900"><CardHeader className="pb-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"><Trash2 className="h-4 w-4" /></div><div><CardTitle id="delete-role-title" className="text-base">Delete {job.title}?</CardTitle><CardDescription className="mt-1 leading-5">This permanently removes the role and its linked criteria, applications, assessments, documents, rankings, and interview drafts. Audit history may be retained according to workspace policy.</CardDescription></div></div></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="delete-role-confirmation">Type <span className="font-semibold text-foreground">{job.title}</span> to confirm</Label><Input id="delete-role-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-1.5 rounded-lg" /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="rounded-xl">Cancel</Button><Button type="button" onClick={onConfirm} disabled={busy || !confirmed} className="rounded-xl bg-red-700 text-white hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete role permanently</Button></div></CardContent></Card>
}

function NewRolePanel({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (payload: { title: string; description: string; department: string; location: string }) => void; busy: boolean }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const valid = title.trim().length > 2 && description.trim().length > 20
  return <Card className="border-primary/30 bg-card shadow-md"><CardHeader className="flex flex-row items-start justify-between gap-3 pb-4"><div><CardTitle className="text-base">Create a role</CardTitle><CardDescription className="mt-1">Paste a job description, then review the proposed criteria before screening.</CardDescription></div><Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-lg"><X className="h-4 w-4" /></Button></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="role-title">Role title</Label><Input id="role-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Senior Product Designer" className="mt-1.5 rounded-lg" /></div><div><Label htmlFor="role-department">Department</Label><Input id="role-department" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Product" className="mt-1.5 rounded-lg" /></div><div><Label htmlFor="role-location">Location</Label><Input id="role-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Remote · US time zones" className="mt-1.5 rounded-lg" /></div><div className="sm:col-span-2"><Label htmlFor="role-description">Job description</Label><Textarea id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the responsibilities and job-relevant outcomes…" className="mt-1.5 min-h-32 rounded-lg" /></div><div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Required fields are validated before the role is saved.</p><Button type="button" onClick={() => onCreate({ title, description, department, location })} disabled={busy || !valid} className="rounded-xl">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create role</Button></div></CardContent></Card>
}

function SidebarContent({ view, onNavigate, onClose }: { view: View; onNavigate: (view: View) => void; onClose?: () => void }) {
  const primary: { id: View; label: string; icon: typeof BriefcaseBusiness }[] = [{ id: 'roles', label: 'Roles', icon: BriefcaseBusiness }, { id: 'jobs', label: 'Intake workspace', icon: Inbox }, { id: 'candidates', label: 'Candidates', icon: UsersRound }, { id: 'interviews', label: 'Interviews', icon: CalendarDays }]
  const source: { id: View; label: string; icon: typeof BriefcaseBusiness }[] = [{ id: 'integrations', label: 'Integrations', icon: Globe2 }]
  const governance: { id: View; label: string; icon: typeof BriefcaseBusiness }[] = [{ id: 'audit', label: 'Audit log', icon: FileText }]
  const group = (label: string, items: { id: View; label: string; icon: typeof BriefcaseBusiness }[]) => <div key={label} className="mt-7"><p className="px-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">{label}</p><div className="mt-2 space-y-1">{items.map(({ id, label: itemLabel, icon: Icon }) => <Button type="button" key={id} variant={view === id ? 'secondary' : 'ghost'} onClick={() => { onNavigate(id); onClose?.() }} className={`h-10 w-full justify-start rounded-xl px-3 text-sm ${view === id ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}><Icon className="mr-3 h-4 w-4" />{itemLabel}</Button>)}</div></div>
  return <><div className="mb-10 flex items-center justify-between"><BrandMark />{onClose && <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-lg lg:hidden"><X className="h-4 w-4" /></Button>}</div>{group('Workspace', primary)}{group('Sources', source)}{group('Governance', governance)}<div className="mt-auto pt-10"><div className="rounded-2xl border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mb-2 h-4 w-4 text-primary" /><p className="font-medium text-foreground">Human approval gates on</p><p className="mt-1">No autonomous rejection or invitation sending.</p></div></div></>
}

function Workspace() {
  const { authFetch, isLoading: authLoading } = useAuth()
  const [view, setView] = useState<View>('roles')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sampleData, setSampleData] = useState(true)
  const [samplePreferenceSet, setSamplePreferenceSet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [agentBusy, setAgentBusy] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [orchestratorData, setOrchestratorData] = useState<OrchestratorData | null>(sampleOrchestratorData)
  const [agentMetadata, setAgentMetadata] = useState<AgentMetadata | null>({ agent_name: 'Recruitment Orchestrator', timestamp: 'Sample workspace state', sub_agents_used: ['Evidence-Based Screener', 'Gmail Resume Intake', 'Google Interview Coordinator', 'Microsoft Interview Coordinator'] })
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [criteriaRecords, setCriteriaRecords] = useState<CriteriaRecord[]>([])
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([])
  const [auditRows, setAuditRows] = useState<AuditRecord[]>([])
  const [roleApplications, setRoleApplications] = useState<RoleApplicationPacket[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState('role-product-design')
  const [selectedCandidateId, setSelectedCandidateId] = useState('candidate-maya')
  const [criteriaDraft, setCriteriaDraft] = useState<Criterion[]>(sampleCriteria)
  const [criteriaApproval, setCriteriaApproval] = useState<'approved' | 'pending' | 'changed_requires_reapproval'>('approved')
  const [criteriaBusy, setCriteriaBusy] = useState(false)
  const [intakeRecords, setIntakeRecords] = useState<CandidateSourceRecord[]>(sampleOrchestratorData.candidate_source_records)
  const [intakeBusy, setIntakeBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [showNewRole, setShowNewRole] = useState(false)
  const [newRoleBusy, setNewRoleBusy] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<JobRecord | null>(null)
  const [deleteRoleBusy, setDeleteRoleBusy] = useState(false)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [rerunBusy, setRerunBusy] = useState(false)
  const [dispositionReason, setDispositionReason] = useState('')
  const [dispositionBusy, setDispositionBusy] = useState(false)
  const [candidateActionBusy, setCandidateActionBusy] = useState(false)
  const [filters, setFilters] = useState({ stage: 'all', source: 'all', score: 'all' })
  const [selectedProvider, setSelectedProvider] = useState<Provider>('both')
  const [selectedSlotId, setSelectedSlotId] = useState(sampleOrchestratorData.scheduling.selected_slot_id)
  const [scheduleBusy, setScheduleBusy] = useState(false)

  const loadWorkspace = async (showToast = false) => {
    setLoading(true)
    try {
      const seedResponse = await authFetch('/api/seed', { method: 'POST' })
      const seedBody = await seedResponse.json() as unknown
      if (!seedResponse.ok || !isRecord(seedBody) || seedBody.success !== true) throw new Error(isRecord(seedBody) && typeof seedBody.error === 'string' ? seedBody.error : 'Workspace seed failed')
      const responses = await Promise.all(['/api/jobs', '/api/candidates', '/api/job_criteria', '/api/integration_connections', '/api/audit_events'].map((path) => authFetch(path)))
      const payloads = await Promise.all(responses.map(async (response) => { const body = await response.json() as unknown; if (!response.ok || !isRecord(body) || body.success !== true || !Array.isArray(body.data)) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Workspace data could not be loaded'); return body.data.filter(isRecord) }))
      const [jobRows, candidateRows, criterionRows, integrationRows, auditEventRows] = payloads
      const parsedJobs = jobRows.map((row) => ({ id: asText(row.id), title: asText(row.title, 'Untitled role'), description: asText(row.description), status: asText(row.status, 'open'), department: asText(row.department), employment_type: asText(row.employment_type, 'Full-time'), location: asText(row.location) })).filter((row) => row.id)
      const parsedCandidates = candidateRows.map((row) => ({ id: asText(row.id), full_name: asText(row.full_name, 'Unnamed candidate'), email: asText(row.email), phone: asText(row.phone), source: asText(row.source, 'direct_upload'), resume_url: asText(row.resume_url) })).filter((row) => row.id)
      const parsedCriteria = criterionRows.map((row) => ({ id: asText(row.id), job_id: asText(row.job_id), name: asText(row.name), criterion_type: (['required', 'preferred', 'disqualifying', 'contextual'].includes(asText(row.criterion_type)) ? asText(row.criterion_type) : 'required') as CriteriaType, description: asText(row.description), minimum_match: asNumber(typeof row.minimum_match === 'string' ? Number(row.minimum_match) : row.minimum_match), weight: asNumber(typeof row.weight === 'string' ? Number(row.weight) : row.weight), approved: row.approved === true })).filter((row) => row.id)
      const parsedIntegrations = integrationRows.map((row) => ({ id: asText(row.id), provider: asText(row.provider), account_email: asText(row.account_email), status: asText(row.status, 'unknown'), connected_at: asText(row.connected_at), last_synced_at: asText(row.last_synced_at) })).filter((row) => row.id)
      const parsedAuditRows = auditEventRows.map((row) => ({ id: asText(row.id), actor_user_id: asText(row.actor_user_id), action: asText(row.action), entity_type: asText(row.entity_type), entity_id: asText(row.entity_id), details: isRecord(row.details) ? row.details : {}, occurred_at: asText(row.occurred_at) })).filter((row) => row.id)
      setJobs(parsedJobs)
      setCandidates(parsedCandidates)
      setCriteriaRecords(parsedCriteria)
      setIntegrations(parsedIntegrations)
      setAuditRows(parsedAuditRows)
      if (parsedJobs.length > 0) setSelectedJobId((current) => parsedJobs.some((job) => job.id === current) ? current : parsedJobs[0].id)
      if (parsedCandidates.length > 0) setSelectedCandidateId((current) => parsedCandidates.some((candidate) => candidate.id === current) ? current : parsedCandidates[0].id)
      if (!samplePreferenceSet && (parsedJobs.length > 0 || parsedCandidates.length > 0)) setSampleData(false)
      if (showToast) toast.success('Workspace refreshed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workspace data could not be loaded'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) void loadWorkspace()
  }, [authLoading])

  useEffect(() => {
    const recordCriteria = criteriaRecords.filter((record) => record.job_id === selectedJobId)
    if (!sampleData) {
      if (recordCriteria.length > 0) {
        setCriteriaDraft(recordCriteria.map((record) => ({ criterion_id: record.id, label: record.name, criterion_type: record.criterion_type, minimum_match: record.minimum_match, weight: record.weight, approved: record.approved, job_relevance_note: record.description || 'Job relevance note not provided.' })))
        setCriteriaApproval(recordCriteria.every((record) => record.approved) ? 'approved' : 'pending')
      } else {
        setCriteriaDraft([])
        setCriteriaApproval('pending')
      }
    }
  }, [criteriaRecords, selectedJobId, sampleData])

  const loadRoleApplications = async (jobId: string) => {
    if (!jobId || jobId.startsWith('role-')) { setRoleApplications([]); return }
    setApplicationsLoading(true)
    try {
      const response = await authFetch(`/api/applications?job_id=${encodeURIComponent(jobId)}`)
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true || !Array.isArray(body.data)) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Role candidates could not be loaded')
      setRoleApplications(body.data.filter(isRecord) as unknown as RoleApplicationPacket[])
    } catch (error) { setRoleApplications([]); toast.error(error instanceof Error ? error.message : 'Role candidates could not be loaded') } finally { setApplicationsLoading(false) }
  }

  useEffect(() => { if (!authLoading && selectedJobId && !sampleData) void loadRoleApplications(selectedJobId) }, [authLoading, selectedJobId, sampleData])

  const runOrchestrator = async (message: string, options?: { assets?: string[] }) => {
    setAgentBusy(true)
    setAgentError(null)
    setActiveAgentId(ORCHESTRATOR_ID)
    try {
      const result = await callAIAgent(message, ORCHESTRATOR_ID, options)
      if (!result.success || result.response?.status !== 'success') throw new Error(result.response?.message ?? 'Recruitment Orchestrator request failed')
      const payload: unknown = result.response.result
      if (!isOrchestratorData(payload)) throw new Error('Recruitment Orchestrator returned an incomplete response. Required workflow fields are missing.')
      setOrchestratorData(payload)
      const metadata = result.response.metadata as unknown
      if (isRecord(metadata) && typeof metadata.agent_name === 'string' && typeof metadata.timestamp === 'string' && Array.isArray(metadata.sub_agents_used)) setAgentMetadata({ agent_name: metadata.agent_name, timestamp: metadata.timestamp, sub_agents_used: metadata.sub_agents_used.filter((item): item is string => typeof item === 'string') })
      return payload
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Recruitment Orchestrator request failed'
      setAgentError(messageText)
      toast.error(messageText)
      return null
    } finally {
      setActiveAgentId(null)
      setAgentBusy(false)
    }
  }

  const visibleJobs = useMemo(() => sampleData ? [...jobs, ...sampleJobs.filter((sample) => !jobs.some((job) => job.id === sample.id))] : jobs, [jobs, sampleData])
  const visibleCriteria = useMemo(() => sampleData && criteriaDraft.length === 0 ? sampleCriteria : criteriaDraft, [criteriaDraft, sampleData])
  const roleCandidates = useMemo(() => roleApplications.flatMap((packet) => packet.candidate ? [{ ...packet.candidate, application_id: packet.application.id, application_stage: packet.application.stage }] : []), [roleApplications])
  const roleAssessments = useMemo(() => roleApplications.filter((packet) => packet.candidate && packet.assessment).map((packet) => {
    const metadata = packet.application.metadata && typeof packet.application.metadata === 'object' ? packet.application.metadata : {}
    const overall = Number(packet.assessment?.overall_score ?? 0)
    const scores: CriterionScore[] = packet.criterion_scores.map((score) => ({ criterion_id: score.job_criterion_id, score: Number(score.score), evidence_excerpts: [], reasoning: score.notes ?? 'Stored criterion assessment.', confidence: 0.75, missing_evidence: Number(score.score) === 0, uncertainty: Number(score.score) === 0 ? 'No evidence was stored for this criterion.' : 'Review the source resume for full context.', protected_attribute_excluded: true }))
    const required = visibleCriteria.filter((criterion) => criterion.criterion_type === 'required')
    const met = required.filter((criterion) => { const score = scores.find((item) => item.criterion_id === criterion.criterion_id); return score && (score.score / 4) * 100 >= criterion.minimum_match }).length
    return { candidate_id: packet.candidate!.id, source_ids: Array.isArray(metadata.source_ids) ? metadata.source_ids.filter((id): id is string => typeof id === 'string') : [], assessment_id: packet.assessment!.id, overall_score: overall, required_criteria_coverage: required.length ? met / required.length : 0, confidence: 0.75, rank_position: 0, criterion_scores: scores, strengths: [], gaps: [], warnings: [], recommended_next_action: packet.application.stage === 'hold' ? 'hold_for_more_information' as const : packet.application.stage === 'interview' ? 'advance_for_human_review' as const : 'review_evidence' as const, autonomous_rejection: false as const }
  }).sort((a, b) => b.overall_score - a.overall_score).map((assessment, index) => ({ ...assessment, rank_position: index + 1 })), [roleApplications, visibleCriteria])
  const visibleCandidates = useMemo(() => sampleData ? sampleCandidates : roleCandidates, [roleCandidates, sampleData])
  const displayedAssessments = useMemo(() => sampleData ? sampleAssessments : roleAssessments, [roleAssessments, sampleData])
  const visibleIntegrations = useMemo(() => sampleData ? [...integrations, ...sampleIntegrations.filter((sample) => !integrations.some((integration) => integration.id === sample.id))] : integrations, [integrations, sampleData])
  const visibleAuditRows = useMemo(() => sampleData ? [...auditRows, ...sampleAuditRows.filter((sample) => !auditRows.some((row) => row.id === sample.id))] : auditRows, [auditRows, sampleData])
  const selectedRole = visibleJobs.find((job) => job.id === selectedJobId)
  const selectedAssessment = displayedAssessments.find((assessment) => assessment.candidate_id === selectedCandidateId)

  useEffect(() => {
    if (roleCandidates.length > 0 && !roleCandidates.some((candidate) => candidate.id === selectedCandidateId)) setSelectedCandidateId(roleCandidates[0].id)
    if (roleCandidates.length === 0 && !sampleData) setSelectedCandidateId('')
  }, [roleCandidates, sampleData, selectedCandidateId])

  const handleSampleToggle = (value: boolean) => {
    setSamplePreferenceSet(true)
    setSampleData(value)
    if (!value && jobs.length === 0 && candidates.length === 0) toast.success('Sample Data hidden. Add a role or resume to continue.')
  }

  const saveCriteria = async (criteria: Criterion[], approved: boolean) => {
    if (!selectedJobId || selectedJobId.startsWith('role-')) throw new Error('Select a saved role before editing criteria.')
    const saved: Criterion[] = []
    for (const criterion of criteria) {
      const existing = criteriaRecords.find((record) => record.id === criterion.criterion_id)
      const response = await authFetch('/api/job_criteria', { method: existing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(existing ? { id: existing.id } : { job_id: selectedJobId }), name: criterion.label.trim(), criterion_type: criterion.criterion_type, minimum_match: criterion.minimum_match, description: criterion.job_relevance_note.trim(), weight: criterion.weight, approved }) })
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true || !isRecord(body.data)) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `Could not save ${criterion.label}`)
      saved.push({ criterion_id: asText(body.data.id), label: asText(body.data.name), criterion_type: asText(body.data.criterion_type, criterion.criterion_type) as CriteriaType, minimum_match: Number(body.data.minimum_match ?? criterion.minimum_match), weight: Number(body.data.weight ?? criterion.weight), approved: body.data.approved === true, job_relevance_note: asText(body.data.description) })
    }
    await loadWorkspace(false)
    setCriteriaDraft(saved)
    return saved
  }

  const handleGenerateCriteria = async () => {
    if (!selectedRole) { toast.error('Select a saved role first.'); return }
    setCriteriaBusy(true)
    setAgentError(null)
    setActiveAgentId(SCREENER_ID)
    try {
      const message = `Create a draft screening rubric for this role only. Role ID: ${selectedRole.id}. Title: ${selectedRole.title}. Job description: ${selectedRole.description}. Return 5-8 job-relevant criteria in the criteria array. Each criterion needs label, criterion_type, weight, approved=false, and job_relevance_note. Importance weights must total 100. Minimum evidence thresholds are independent: include minimum_match when supported; otherwise the app will apply safe defaults. Exclude protected and proxy attributes. Do not screen candidates in this request.`
      const response = await Promise.race([
        callAIAgent(message, SCREENER_ID),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Criteria generation timed out')), 30000)),
      ])
      const generated = response.success && response.response?.status === 'success' ? extractCriteria(response.response.result) : []
      const draft = generated.length ? generated : fallbackCriteria(selectedRole)
      setCriteriaDraft(draft)
      setCriteriaApproval('pending')
      toast.success(generated.length ? 'AI draft generated. Review it, then Save changes.' : 'A safe draft was generated from the job description. Review it, then Save changes.')
    } catch (error) {
      const draft = fallbackCriteria(selectedRole)
      setCriteriaDraft(draft)
      setCriteriaApproval('pending')
      toast.info('The AI service did not return a usable draft, so a job-description draft was created locally. Review it before saving.')
    } finally {
      setActiveAgentId(null)
      setCriteriaBusy(false)
    }
  }

  const handleSaveCriteria = async () => {
    if (!visibleCriteria.length) return
    setCriteriaBusy(true)
    try { await saveCriteria(visibleCriteria, false); setCriteriaApproval('pending'); toast.success('Criteria changes saved') } catch (error) { toast.error(error instanceof Error ? error.message : 'Criteria could not be saved') } finally { setCriteriaBusy(false) }
  }

  const handleDeleteCriterion = async (criterion: Criterion) => {
    if (criterion.criterion_id.startsWith('new-')) { setCriteriaDraft((current) => current.filter((item) => item.criterion_id !== criterion.criterion_id)); setCriteriaApproval('pending'); return }
    setCriteriaBusy(true)
    try {
      const response = await authFetch(`/api/job_criteria?id=${encodeURIComponent(criterion.criterion_id)}`, { method: 'DELETE' })
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Criterion could not be removed')
      setCriteriaDraft((current) => current.filter((item) => item.criterion_id !== criterion.criterion_id))
      setCriteriaRecords((current) => current.filter((item) => item.id !== criterion.criterion_id))
      setCriteriaApproval('pending')
      toast.success('Criterion removed')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Criterion could not be removed') } finally { setCriteriaBusy(false) }
  }

  const handleApproveCriteria = async () => {
    if (visibleCriteria.reduce((sum, criterion) => sum + criterion.weight, 0) !== 100) { toast.error('Criteria weights must total 100% before approval.'); return }
    setCriteriaBusy(true)
    try {
      const saved = await saveCriteria(visibleCriteria, true)
      setCriteriaApproval('approved')
      const result = await runOrchestrator(`Record approval of the recruiter-edited criteria for role ${selectedJobId}. These persisted criteria are explicitly approved: ${JSON.stringify(saved)}. Confirm job relevance, exclude protected or proxy attributes, preserve prior assessments, and return the complete orchestration response.`)
      if (result) setOrchestratorData(result)
      toast.success('Criteria approved. Continue to Intake to add resumes.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Criteria approval failed') } finally { setCriteriaBusy(false) }
  }

  const handleRerun = async () => {
    if (criteriaApproval !== 'approved') { setView('criteria'); toast.error('Approve the current criteria version before rerunning screening.'); return }
    setRerunBusy(true)
    const result = await runOrchestrator(`Rerun evidence-based screening for role ${selectedJobId} against approved criteria ${JSON.stringify(visibleCriteria)}. Preserve prior assessments, cite resume evidence, show missing evidence as uncertainty, and return the complete ranking response without autonomous rejection.`)
    setRerunBusy(false)
    if (result) toast.success('Ranking rerun completed with human review preserved')
  }

  const handleSync = async (provider: 'gmail' | 'outlook') => {
    setIntakeBusy(true)
    const label = provider === 'gmail' ? 'Gmail' : 'Outlook'
    const result = await runOrchestrator(`Run a recruiter-requested ${label} resume intake for role ${selectedJobId}. Use the already authorized provider context, find likely application attachments, normalize candidate-source records, identify duplicates, preserve source provenance, and return every required field for the complete orchestration response. Do not assign or reject candidates without recruiter review.`)
    setIntakeBusy(false)
    if (result) { setIntakeRecords(result.candidate_source_records); toast.success(`${label} intake completed; review matches before screening`) }
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    if (!selectedRole || selectedRole.id.startsWith('role-')) { toast.error('Select a saved role before uploading resumes.'); return }
    if (criteriaApproval !== 'approved') { toast.error('Approve this role’s criteria before uploading resumes.'); setView('criteria'); return }
    setUploadBusy(true)
    setAgentError(null)
    setActiveAgentId(SCREENER_ID)
    let completed = 0
    let pending = 0
    try {
      for (const file of files) {
        const upload = await uploadFiles(file)
        if (!upload.success || !upload.asset_ids?.length) throw new Error(upload.error || upload.message || `Upload failed for ${file.name}`)
        const assetId = upload.asset_ids[0]
        let screening: ReturnType<typeof extractScreening> = null
        try {
          const agent = await Promise.race([
            callAIAgent(`Screen this uploaded resume only for role ${selectedRole.title} (${selectedRole.id}) against these approved criteria: ${JSON.stringify(visibleCriteria)}. Return candidate identity and one candidate assessment with criterion scores. Missing evidence is uncertainty, protected attributes are excluded, and no autonomous rejection is allowed.`, SCREENER_ID, { assets: [assetId] }),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Resume screening timed out')), 60000)),
          ])
          if (agent.success && agent.response?.status === 'success') screening = extractScreening(agent.response.result)
        } catch {}
        const response = await authFetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: selectedRole.id, asset_id: assetId, file_name: file.name, full_name: screening?.full_name || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), email: screening?.email || '', screening_status: screening ? 'completed' : 'pending', overall_score: screening?.overall_score, notes: screening?.notes, criterion_scores: screening?.criterion_scores ?? [] }) })
        const body = await response.json() as unknown
        if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `Could not attach ${file.name} to ${selectedRole.title}`)
        if (screening) completed += 1; else pending += 1
      }
      await Promise.all([loadWorkspace(false), loadRoleApplications(selectedRole.id)])
      setSampleData(false)
      setView('candidates')
      if (pending) toast.warning(`${completed} resume screened; ${pending} saved for pending screening. No upload was lost.`)
      else toast.success(`${completed} resume${completed === 1 ? '' : 's'} uploaded, screened, and attached to ${selectedRole.title}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resume upload failed'
      setAgentError(message)
      toast.error(message)
    } finally {
      setActiveAgentId(null)
      setUploadBusy(false)
    }
  }

  const handleDisposition = async (action: 'advance' | 'hold' | 'decline') => {
    if (!dispositionReason.trim()) { toast.error('Add a human-authored reason before changing candidate disposition.'); return }
    if (!selectedAssessment) return
    const selectedCandidate = roleCandidates.find((candidate) => candidate.id === selectedAssessment.candidate_id)
    if (!selectedCandidate?.application_id) { toast.error('This candidate is not attached to the selected role.'); return }
    setDispositionBusy(true)
    const stage = action === 'advance' ? 'interview' : action
    try {
      const response = await authFetch('/api/applications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedCandidate.application_id, stage, metadata: { disposition_reason: dispositionReason.trim(), disposition_action: action } }) })
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Disposition could not be saved')
      await runOrchestrator(`Record the recruiter disposition for candidate ${selectedAssessment.candidate_id} in role ${selectedJobId}. Action: ${action}. Human-authored reason: ${dispositionReason.trim()}. Preserve the original assessment and never perform autonomous rejection.`)
      await loadRoleApplications(selectedJobId)
      setDispositionReason('')
      toast.success(`Candidate ${action} decision saved for this role`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Disposition could not be saved') } finally { setDispositionBusy(false) }
  }

  const handleRemoveCandidateFromRole = async () => {
    const candidate = roleCandidates.find((item) => item.id === selectedCandidateId)
    if (!candidate?.application_id || !selectedRole) return
    if (!window.confirm(`Remove ${candidate.full_name} from ${selectedRole.title}? Their candidate profile will remain available for other roles.`)) return
    setCandidateActionBusy(true)
    try {
      const response = await authFetch(`/api/applications?id=${encodeURIComponent(candidate.application_id)}`, { method: 'DELETE' })
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Candidate could not be removed from this role')
      await loadRoleApplications(selectedJobId)
      setSelectedCandidateId('')
      toast.success(`${candidate.full_name} removed from ${selectedRole.title}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Candidate could not be removed') } finally { setCandidateActionBusy(false) }
  }

  const handleDeleteCandidatePermanently = async () => {
    const candidate = roleCandidates.find((item) => item.id === selectedCandidateId)
    if (!candidate || !window.confirm(`Permanently delete ${candidate.full_name} and all linked applications? This cannot be undone.`)) return
    setCandidateActionBusy(true)
    try {
      const response = await authFetch(`/api/candidates?id=${encodeURIComponent(candidate.id)}`, { method: 'DELETE' })
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Candidate could not be deleted')
      await loadRoleApplications(selectedJobId)
      setCandidates((current) => current.filter((item) => item.id !== candidate.id))
      setSelectedCandidateId('')
      toast.success(`${candidate.full_name} permanently deleted`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Candidate could not be deleted') } finally { setCandidateActionBusy(false) }
  }

  const handleScheduleRefresh = async () => {
    setScheduleBusy(true)
    const result = await runOrchestrator(`Refresh interview availability for candidate ${orchestratorData?.candidate_id ?? 'candidate-maya'} and role ${selectedJobId}. Provider selection: ${selectedProvider}. Recheck all participant calendars, invalidate stale slots, preserve the draft, and return the complete scheduling response. Do not create an event or send an invitation.`)
    setScheduleBusy(false)
    if (result) { setSelectedSlotId(result.scheduling.selected_slot_id); toast.success('Availability refreshed; review the new draft options') }
  }

  const handleApproveAndSend = async () => {
    if (!selectedSlotId) { toast.error('Select a fresh slot before approval.'); return }
    if (!orchestratorData?.scheduling || orchestratorData.scheduling.approval_state !== 'pending') { toast.error('This scheduling draft is not awaiting approval. Refresh availability if it is stale.'); return }
    setScheduleBusy(true)
    const result = await runOrchestrator(`Explicit recruiter approval: approve and send the interview draft ${orchestratorData.scheduling.scheduling_draft_id} for candidate ${orchestratorData.candidate_id}. Selected slot: ${selectedSlotId}. Provider: ${selectedProvider}. Create the calendar event and send invitations only now, return the complete orchestration response, and record audit event IDs.`)
    setScheduleBusy(false)
    if (result) { setSelectedSlotId(result.scheduling.selected_slot_id); toast.success('Approval submitted; event and invitation status returned by the provider workflow') }
  }

  const handleCreateRole = async (payload: { title: string; description: string; department: string; location: string }) => {
    setNewRoleBusy(true)
    try {
      const response = await authFetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, status: 'open', employment_type: 'Full-time' }) })
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Role could not be created')
      setShowNewRole(false)
      await loadWorkspace(false)
      const created = isRecord(body.data) ? asText(body.data.id) : ''
      if (created) setSelectedJobId(created)
      toast.success('Role created. Review proposed criteria before screening.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Role could not be created')
    } finally {
      setNewRoleBusy(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!roleToDelete) return
    setDeleteRoleBusy(true)
    try {
      const response = await authFetch(`/api/jobs?id=${encodeURIComponent(roleToDelete.id)}`, { method: 'DELETE' })
      const body = await response.json() as unknown
      if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : 'Role could not be deleted')
      const deletedTitle = roleToDelete.title
      setRoleToDelete(null)
      setJobs((current) => {
        const remaining = current.filter((job) => job.id !== roleToDelete.id)
        setSelectedJobId(remaining[0]?.id ?? '')
        return remaining
      })
      setCriteriaRecords((current) => current.filter((criterion) => criterion.job_id !== roleToDelete.id))
      toast.success(`${deletedTitle} was deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Role could not be deleted')
    } finally {
      setDeleteRoleBusy(false)
    }
  }

  const selectedRoles = visibleJobs.filter((job) => selectedRoleIds.has(job.id) && !job.id.startsWith('role-'))

  const handleRoleSelection = (id: string, checked: boolean) => setSelectedRoleIds((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next })
  const handleSelectAllRoles = (checked: boolean, ids: string[]) => setSelectedRoleIds((current) => { const next = new Set(current); ids.forEach((id) => checked ? next.add(id) : next.delete(id)); return next })
  const handleOpenRole = (job: JobRecord, destination: 'overview' | 'criteria' | 'candidates' | 'intake' | 'activity') => {
    setSelectedJobId(job.id)
    setSampleData(job.id.startsWith('role-'))
    if (destination === 'criteria') setView('criteria')
    else if (destination === 'candidates') setView('candidates')
    else if (destination === 'activity') setView('audit')
    else setView('jobs')
  }

  const handleArchiveSelected = async () => {
    if (selectedRoles.length === 0) return
    setDeleteRoleBusy(true)
    try {
      for (const job of selectedRoles) {
        const response = await authFetch('/api/jobs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, status: 'archived' }) })
        const body = await response.json() as unknown
        if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `Could not archive ${job.title}`)
      }
      setJobs((current) => current.map((job) => selectedRoleIds.has(job.id) ? { ...job, status: 'archived' } : job))
      setSelectedRoleIds(new Set())
      toast.success(`${selectedRoles.length} role${selectedRoles.length === 1 ? '' : 's'} archived`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Roles could not be archived') } finally { setDeleteRoleBusy(false) }
  }

  const handleBulkDelete = async () => {
    if (selectedRoles.length === 0) return
    setDeleteRoleBusy(true)
    try {
      for (const job of selectedRoles) {
        const response = await authFetch(`/api/jobs?id=${encodeURIComponent(job.id)}`, { method: 'DELETE' })
        const body = await response.json() as unknown
        if (!response.ok || !isRecord(body) || body.success !== true) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `Could not delete ${job.title}`)
      }
      const deletedIds = new Set(selectedRoles.map((job) => job.id))
      setJobs((current) => current.filter((job) => !deletedIds.has(job.id)))
      setCriteriaRecords((current) => current.filter((criterion) => !deletedIds.has(criterion.job_id)))
      setSelectedRoleIds(new Set())
      setBulkDeleteOpen(false)
      if (deletedIds.has(selectedJobId)) setSelectedJobId('')
      toast.success(`${selectedRoles.length} role${selectedRoles.length === 1 ? '' : 's'} deleted`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Roles could not be deleted') } finally { setDeleteRoleBusy(false) }
  }

  const pageTitle = view === 'roles' ? 'Roles' : view === 'jobs' ? 'Role workspace' : view === 'criteria' ? 'Review criteria' : view === 'candidates' ? 'Candidate ranking' : view === 'interviews' ? 'Coordinate interview' : view === 'integrations' ? 'Integrations' : 'Audit log'

  return <div className="min-h-screen bg-background font-sans text-foreground antialiased"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card p-5 lg:flex"><SidebarContent view={view} onNavigate={setView} /></aside>{mobileNavOpen && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 bg-foreground/30" onClick={() => setMobileNavOpen(false)} /><aside className="relative flex h-full w-[min(86vw,300px)] flex-col border-r border-border bg-card p-5 shadow-xl"><SidebarContent view={view} onNavigate={setView} onClose={() => setMobileNavOpen(false)} /></aside></div>}<div className="lg:pl-64"><header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur"><div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Button type="button" variant="outline" size="icon" onClick={() => setMobileNavOpen(true)} className="h-10 w-10 shrink-0 rounded-xl lg:hidden"><Menu className="h-4 w-4" /></Button><div className="hidden min-w-0 items-center gap-2 md:flex"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><Input aria-label="Search workspace" placeholder="Search jobs, candidates, interviews" className="h-10 w-[min(38vw,320px)] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" /></div><div className="min-w-0 md:hidden"><p className="truncate text-sm font-semibold">{pageTitle}</p><p className="truncate text-[11px] text-muted-foreground">HireFlow workspace</p></div></div><div className="flex shrink-0 items-center gap-2"><Badge variant="outline" className="hidden rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 sm:inline-flex"><CircleDot className="mr-1.5 h-3 w-3" />{visibleIntegrations.filter((item) => item.status === 'healthy').length} integrations healthy</Badge><Button type="button" variant="ghost" size="icon" className="hidden h-10 w-10 rounded-xl sm:inline-flex" title="Notifications"><Bell className="h-4 w-4" /></Button><ThemeToggle /><UserMenu /></div></div></header><main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><AgentStatusStrip activeAgentId={activeAgentId} />{agentError && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{agentError}</span></div><Button type="button" variant="outline" onClick={() => setAgentError(null)} className="h-9 rounded-lg border-red-200 bg-transparent text-xs text-red-800 hover:bg-red-100 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/50">Dismiss</Button></div>}{showNewRole && <NewRolePanel onClose={() => setShowNewRole(false)} onCreate={handleCreateRole} busy={newRoleBusy} />}{bulkDeleteOpen && <BulkDeleteRolesPanel jobs={selectedRoles} onCancel={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} busy={deleteRoleBusy} />}{roleToDelete && <DeleteRolePanel job={roleToDelete} onCancel={() => setRoleToDelete(null)} onConfirm={handleDeleteRole} busy={deleteRoleBusy} />}{view === 'roles' && <RolesView jobs={visibleJobs} criteriaRecords={criteriaRecords} selectedIds={selectedRoleIds} onSelectionChange={handleRoleSelection} onSelectAll={handleSelectAllRoles} onOpenRole={handleOpenRole} onNewRole={() => setShowNewRole(true)} onArchiveSelected={handleArchiveSelected} onDeleteSelected={() => setBulkDeleteOpen(true)} actionBusy={deleteRoleBusy} />}{view === 'jobs' && <JobsView jobs={visibleJobs} candidates={visibleCandidates} integrations={visibleIntegrations} criteria={visibleCriteria} criteriaApproval={criteriaApproval} onCriteriaChange={(next) => { setCriteriaDraft(next); setCriteriaApproval('changed_requires_reapproval') }} onApproveCriteria={handleApproveCriteria} criteriaBusy={criteriaBusy} onSelectJob={(id) => { setSelectedJobId(id); setView('jobs') }} selectedJobId={selectedJobId} onOpenCriteria={() => setView('criteria')} onOpenCandidates={() => setView('candidates')} onNewRole={() => setShowNewRole(true)} onDeleteRole={setRoleToDelete} deleteBusy={deleteRoleBusy} onUpload={handleUpload} uploadBusy={uploadBusy} onSync={handleSync} onReviewIntake={() => setView('jobs')} intakeRecords={intakeRecords} intakeBusy={intakeBusy} sampleData={sampleData} onToggleSample={handleSampleToggle} loading={loading} />}{view === 'criteria' && <CriteriaView roleTitle={selectedRole?.title ?? ''} criteria={visibleCriteria} approvalState={criteriaApproval} onChange={(next) => { setCriteriaDraft(next); setCriteriaApproval('changed_requires_reapproval') }} onApprove={handleApproveCriteria} onGenerate={handleGenerateCriteria} onSave={handleSaveCriteria} onDelete={handleDeleteCriterion} busy={criteriaBusy} data={orchestratorData} onRerun={handleRerun} rerunBusy={rerunBusy} onBackToRoles={() => setView('roles')} onGoToIntake={() => setView('jobs')} onGoToCandidates={() => setView('candidates')} />}{view === 'candidates' && <CandidatesView roleTitle={selectedRole?.title ?? ''} criteria={visibleCriteria} assessments={displayedAssessments} candidates={visibleCandidates} selectedCandidateId={selectedCandidateId} onSelectCandidate={setSelectedCandidateId} selectedAssessment={selectedAssessment} onDisposition={handleDisposition} dispositionReason={dispositionReason} onReasonChange={setDispositionReason} dispositionBusy={dispositionBusy} onRemoveFromRole={handleRemoveCandidateFromRole} onDeletePermanently={handleDeleteCandidatePermanently} candidateActionBusy={candidateActionBusy} loading={applicationsLoading} data={orchestratorData} onEditCriteria={() => setView('criteria')} onRerun={handleRerun} rerunBusy={rerunBusy} filters={filters} onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} />}{view === 'interviews' && <InterviewsView data={orchestratorData} selectedProvider={selectedProvider} onProviderChange={setSelectedProvider} selectedSlotId={selectedSlotId} onSelectSlot={setSelectedSlotId} onRefresh={handleScheduleRefresh} onApprove={handleApproveAndSend} busy={scheduleBusy} onEditConstraints={() => toast.info('Edit constraints is ready for the next scheduling request.')} />}{view === 'integrations' && <IntegrationsView integrations={visibleIntegrations} onSync={handleSync} syncBusy={intakeBusy} />}{view === 'audit' && <AuditView auditRows={visibleAuditRows} data={orchestratorData} />}{orchestratorData && <ResponseTrace data={orchestratorData} metadata={agentMetadata} />}</main></div></div>
}

export default function Page() {
  return <AuthProvider><Toaster richColors position="top-right" /><ProtectedRoute unauthenticatedFallback={<AuthScreen />}><Workspace /></ProtectedRoute></AuthProvider>
}
