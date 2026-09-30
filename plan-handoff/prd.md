# HireFlow Agent

## 1. Overview

HireFlow Agent is a secure recruitment operations workspace for screening incoming resumes against active job descriptions, producing explainable candidate rankings, and coordinating interviews across Google Workspace and Microsoft 365.

Recruiters can upload resumes and job descriptions directly or ingest resume attachments from connected Gmail and Outlook inboxes. The system extracts job requirements, evaluates evidence from each resume, and creates a ranked shortlist with criterion-level scores, strengths, gaps, confidence, and source citations. It does not make final hiring decisions or automatically reject candidates.

For candidates advanced by a recruiter, the system compares hiring-team availability through Google Calendar or Microsoft Calendar and recommends interview slots. No invitation is sent until a recruiter approves a slot and confirms the participants.

### Product boundaries

- Assist—not replace—human hiring decisions.
- Never infer or score protected characteristics.
- Ignore photos, names, addresses, graduation years, and other non-job-relevant signals when scoring.
- Never fabricate resume evidence or treat missing information as proof of lacking a skill.
- Never send interview invitations without explicit recruiter approval.
- Preserve an audit trail of score changes, recruiter decisions, and scheduling actions.

### Success criteria

- Every score is traceable to a job criterion and cited resume evidence.
- Recruiters can compare and override rankings without losing the original assessment.
- Duplicate candidates from uploads and inboxes are detected for review.
- Suggested interview times respect participant time zones and availability.
- Invitations are sent only after an approval action.
- Users can see which connected provider supplied each message or calendar event.

## 2. User Stories

- As a recruiter, I can sign up and securely access only my organization’s recruitment records.
- As a recruiter, I can create a role by uploading or pasting a job description.
- As a recruiter, I can define required, preferred, and disqualifying criteria before screening.
- As a recruiter, I can upload one or many PDF/DOCX resumes.
- As a recruiter, I can connect Gmail, Outlook, or both and choose which inboxes or folders to monitor.
- As a recruiter, I can review newly detected resume attachments before adding them to a role.
- As a recruiter, I can see a ranked candidate list with weighted scores, confidence, evidence, and gaps.
- As a recruiter, I can open a candidate assessment and inspect every criterion against cited resume text.
- As a recruiter, I can adjust criteria weights and rerun the ranking while retaining assessment history.
- As a recruiter, I can advance, hold, or decline a candidate with a required human-authored reason.
- As a hiring manager, I can be included in interview availability checks through my connected calendar.
- As a recruiter, I can review proposed interview slots across Google and Microsoft calendars.
- As a recruiter, I can approve a slot before the system creates the event and sends invitations.
- As an administrator, I can inspect integration health and an audit history of automated and human actions.

## 3.a. Agent Architecture

A manager agent controls the workflow and delegates only to the source- or task-specific sub-agent required for the current step. Provider-specific agents keep Google and Microsoft permissions isolated.

| Agent Type | Agent Name | Description | Tools/Data Sources | Trigger | Provider | Model | Temperature | Top_p |
|---|---|---|---|---|---|---|---:|---:|
| Manager | Recruitment Orchestrator | Routes intake, screening, ranking, approval, and scheduling tasks; enforces human approval and returns a unified result to the app. | Outputs from all sub-agents; role configuration; recruiter approval state | New intake, screening request, rerank request, or approved interview slot | Anthropic | `anthropic/claude-sonnet-4-6` | 0.2 | 0.9 |
| Sub-Agent | Gmail Resume Intake | Searches authorized Gmail scope for likely applications, retrieves relevant attachments, and returns normalized candidate-source records for recruiter review. | `gmail` (`composio`) | Manual inbox sync or configured intake run | Anthropic | `anthropic/claude-sonnet-4-6` | 0.1 | 0.9 |
| Sub-Agent | Outlook Resume Intake | Searches authorized Outlook scope for likely applications, retrieves relevant attachments, and returns normalized candidate-source records for recruiter review. | `MICROSOFT_OUTLOOK` (`aci`) | Manual inbox sync or configured intake run | Anthropic | `anthropic/claude-sonnet-4-6` | 0.1 | 0.9 |
| Sub-Agent | Evidence-Based Screener | Converts job descriptions into reviewable criteria, evaluates resumes only against approved criteria, cites evidence, records uncertainty, and produces comparable scorecards. | Parsed job descriptions and resumes supplied by the app | Recruiter starts screening or changes approved criteria | Anthropic | `anthropic/claude-sonnet-4-6` | 0.1 | 0.9 |
| Sub-Agent | Google Interview Coordinator | Checks authorized Google Calendar availability, proposes time-zone-safe slots, and creates the event only after approval; uses Gmail for the approved communication. | `googlecalendar` and `gmail` (`composio`) | Recruiter requests options or approves a Google-based slot | Anthropic | `anthropic/claude-sonnet-4-6` | 0.1 | 0.9 |
| Sub-Agent | Microsoft Interview Coordinator | Checks authorized Microsoft Calendar availability, proposes time-zone-safe slots, and creates the event only after approval; uses Outlook for the approved communication. | `MICROSOFT_CALENDAR` and `MICROSOFT_OUTLOOK` (`aci`) | Recruiter requests options or approves a Microsoft-based slot | Anthropic | `anthropic/claude-sonnet-4-6` | 0.1 | 0.9 |

## 3.c. Screening and Ranking Logic

1. Parse the job description into recruiter-editable criteria.
2. Classify criteria as required, preferred, disqualifying, or contextual.
3. Require recruiter confirmation of criteria and weights before the first ranked run.
4. Extract only job-relevant resume evidence.
5. Score each criterion on a consistent anchored scale:
   - `0`: no relevant evidence found
   - `1`: limited or indirect evidence
   - `2`: partial evidence
   - `3`: clear evidence
   - `4`: strong, directly relevant evidence
6. Attach citations, reasoning, and confidence to each criterion score.
7. Calculate a weighted overall score; show required-criterion coverage separately.
8. Rank candidates within one role only—never across unrelated roles.
9. Mark ambiguous or unreadable inputs for human review rather than guessing.
10. Preserve prior assessments when criteria or weights change.

Ranking is decision support. The UI must not label candidates as objectively “best,” and a low score must not automatically trigger rejection.

## 3.d. Scheduling Controls

- The recruiter selects interview type, duration, participants, date range, working hours, buffer, time zone, and calendar provider.
- The relevant scheduling agent returns several mutually available slots.
- Candidate availability is treated as a recruiter-entered constraint unless captured through a reply handled by an approved future workflow.
- Proposed slots remain drafts.
- Approval shows a final summary of candidate, participants, time zones, event title, conferencing details, and message.
- Only the explicit **Approve & send** action may create the calendar event and dispatch invitations.
- If availability changes before approval, the app invalidates the stale option and requests fresh suggestions.
- Cancellation and rescheduling also require human confirmation.

## 3.e. Safety, Fairness, and Auditability

- Exclude names, photos, pronouns, age indicators, nationality, addresses, disability information, marital status, and other protected or proxy attributes from scoring.
- Do not infer protected attributes from names, schools, employers, language, or location.
- Display a warning if recruiter-authored criteria appear discriminatory or unrelated to job performance.
- Show missing evidence as “not found,” not as a definitive lack of ability.
- Keep the original resume, extracted text, approved criteria, model assessment, recruiter override, and final action traceable.
- Require a recruiter reason for ranking overrides and candidate disposition changes.
- Provide configurable retention and deletion controls for candidate data.
- Restrict integrations to the minimum requested inbox, folder, and calendar scopes.

## 3.f. Response Structure

The orchestration response should provide:

- Workflow status and any item requiring recruiter attention
- Candidate identity and source
- Overall score, required-criteria coverage, and confidence
- Criterion-level score, evidence excerpts, gaps, and uncertainty
- Ranking explanation and material tie-breakers
- Duplicate or parsing warnings
- Recommended next action, never an autonomous final hiring decision
- For scheduling: provider, participants, proposed slots, time zones, and approval state
- Machine-readable identifiers for the role, candidate, assessment, and scheduling draft

## 3.g. Database Configuration

Use the built-in PostgreSQL service with owner- and organization-scoped access.

### Authentication

- Email/password sign-up and login
- Every application screen is authentication-gated
- Password reset and session expiry
- Organization membership with recruiter, hiring manager, and admin roles

### Core records

- `users`: account identity and organization membership
- `organizations`: tenant boundary and retention settings
- `jobs`: title, description, status, owner, and hiring team
- `job_criteria`: criterion type, weight, order, and approval state
- `candidates`: normalized identity and contact fields
- `applications`: candidate-to-job relationship, source, stage, and disposition
- `documents`: resume/job file metadata, extracted text, parsing status, and source
- `assessments`: model version, overall score, required coverage, confidence, and run timestamp
- `criterion_scores`: score, evidence citation, reasoning, confidence, and missing-evidence state
- `ranking_snapshots`: ordered results tied to one approved criteria version
- `integration_connections`: provider, encrypted connection reference, owner, scopes, and health
- `interview_drafts`: duration, participants, constraints, candidate availability, and approval state
- `slot_options`: proposed start/end times, provider, time zones, and freshness
- `interviews`: approved event metadata and provider event reference
- `audit_events`: actor, action, entity, before/after summary, and timestamp

All queries must enforce organization ownership. Files must never be stored in browser local storage. Deleting a candidate should remove or anonymize linked records according to configured retention rules.

## 4. User Flow

1. User signs up or logs in.
2. User connects Google Workspace, Microsoft 365, or both.
3. User creates a role and uploads or pastes its job description.
4. The screener proposes required and preferred criteria.
5. User edits weights and explicitly approves the criteria.
6. User uploads resumes, runs Gmail/Outlook intake, or combines both.
7. Inbox matches appear in a review queue; the user confirms role assignment and resolves duplicates.
8. The orchestrator sends confirmed documents to the screener.
9. The app presents a ranked list with confidence, required coverage, gaps, and evidence.
10. User opens a candidate detail drawer, reviews citations, and chooses advance, hold, or decline.
11. For an advanced candidate, user selects interview settings and hiring-team participants.
12. The appropriate Google or Microsoft coordinator proposes available slots.
13. User selects a slot and reviews the final event and invitation.
14. User clicks **Approve & send**.
15. The event is created, invitations are sent, and the audit timeline records the action.
16. User can later reschedule or cancel through another approval-gated flow.

## 5. Integrations Required

Only authorized live-context actions from the listed integrations are used. Connection setup should request the narrowest viable scopes.

| Integration | Tool Source | Required use |
|---|---|---|
| `gmail` | `composio` | Search authorized recruiting mail, read selected application messages, retrieve resume attachments, and send recruiter-approved interview communications |
| `MICROSOFT_OUTLOOK` | `aci` | Search authorized recruiting mail, read selected application messages, retrieve resume attachments, and send recruiter-approved interview communications |
| `googlecalendar` | `composio` | Read participant availability and create/update/cancel events only after recruiter approval |
| `MICROSOFT_CALENDAR` | `aci` | Read participant availability and create/update/cancel events only after recruiter approval |

The direct upload flow uses the application’s file-ingestion pipeline rather than an external agent integration. No invitation action may run from a slot recommendation alone.

## 6. UI/UX Specification

The product uses a calm, compact B2B dashboard with strong hierarchy, restrained color, and clear audit states. A left rail provides Jobs, Candidates, Interviews, Inbox Intake, Integrations, and Audit Log. The top bar contains global search, integration health, notifications, and an app-owned light/dark toggle.

1. **Login + Sign Up:** A focused split authentication screen with organization name, work email, password, terms, and a concise statement about human-controlled hiring decisions. All later screens are gated.
2. **Jobs & Intake:** Active roles appear as compact cards with candidate totals, unscreened intake, stage distribution, and hiring-team avatars. The selected role exposes job criteria and weight controls. A prominent intake panel supports drag-and-drop resume upload plus Gmail/Outlook sync actions and connection states.
3. **Candidate Ranking:** A dense but readable comparison table shows rank, candidate, score, required coverage, confidence, stage, and top evidence. Persistent filters cover score, stage, source, missing requirements, and review status. Selecting a row opens an evidence drawer with criterion-level scoring and resume citations. Rankings use neutral language and never auto-reject.
4. **Interview Coordination:** A two-column scheduling workspace shows the candidate and interview constraints beside provider-grouped slot recommendations. Google and Microsoft availability are visually distinguished without changing the core workflow. A sticky approval summary makes the final side effect explicit; **Approve & send** is the only invitation trigger.

All agent activity uses progressive status labels such as “Parsing,” “Checking evidence,” and “Finding availability.” Errors remain actionable, provider-specific, and resumable. Keyboard navigation, WCAG AA contrast, visible focus, and text labels beyond color are required.

## Artifacts & references

- App mockup: four core screens covering authentication, intake, ranking, and scheduling
- Reusable skill: explainable, bias-aware resume screening rubric
- Live integrations: Gmail, Microsoft Outlook, Google Calendar, Microsoft Calendar
- Hosted model: Anthropic `anthropic/claude-sonnet-4-6`
- Theme: `tw:graphite`