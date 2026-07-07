# HR Recruitment / Sourcing module — design

**Date:** 2026-07-08
**Status:** Approved (via brainstorming)
**Scope:** Activate the "Recruitment" HR nav stub into a real module covering the
six requested features via two entities. Employee-management tweaks (CTC removal,
project allocation count, payroll cleanup) were deferred by the user.

## Feature → entity mapping

| Requested feature | Home |
|---|---|
| Company Role / Position Details | `JobPosition` |
| Job Description | `JobPosition.jobDescription` |
| Total Manpower Requirement | `JobPosition.openings` (+ dashboard rollup) |
| Candidate Sourcing | `Candidate.source` |
| CV Tracker | `Candidate.cvReceived` + `Candidate.cvLink` (link-only; no file storage) |
| Employee Hiring Status | `Candidate.stage` (8-stage pipeline) |

## Data model (additive migration; 2 models + 2 enums)

```prisma
enum PositionStatus { OPEN ON_HOLD CLOSED }
enum HiringStage { SOURCED SCREENING SHORTLISTED INTERVIEW OFFER HIRED REJECTED ON_HOLD }

model JobPosition {
  id             String  @id @default(cuid())
  title          String
  code           String? @unique          // optional req code, e.g. REQ-0001
  department     String?
  band           String?
  location       String?
  employmentType String?                   // Full-time / Contract / Intern / Consultant
  openings       Int     @default(1)       // Total Manpower Requirement
  jobDescription String?                    // long text
  status         PositionStatus @default(OPEN)
  candidates     Candidate[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([status])
}

model Candidate {
  id              String   @id @default(cuid())
  name            String
  email           String?
  phone           String?
  positionId      String?
  position        JobPosition? @relation(fields: [positionId], references: [id], onDelete: SetNull)
  source          String?     // Referral / Job Portal / Agency / LinkedIn / Walk-in / Other
  stage           HiringStage @default(SOURCED)
  cvReceived      Boolean  @default(false)
  cvLink          String?
  experienceYears Float?
  noticePeriod    String?
  appliedOn       DateTime? @db.Date
  notes           String?
  hiredEmployeeId String?    // set when converted to an Employee (loose link)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([positionId])
  @@index([stage])
}
```

A position with candidates can be deleted — candidates keep their history with a
null position (`onDelete: SetNull`). CTC fields are intentionally omitted from
Candidate (consistent with the CTC de-emphasis).

## Validation — `src/lib/recruitment-validation.ts`

Zod + shared constant lists: `POSITION_STATUSES`, `HIRING_STAGES`,
`CANDIDATE_SOURCES`, `EMPLOYMENT_TYPES`, `positionSchema`, `candidateSchema`
(name required; email valid-if-present; `openings` ≥ 0; `experienceYears` ≥ 0;
enums constrained; `cvLink`/`positionId` optional). Server + client validate
identically, matching the BD/HR pattern.

## Status colours — extend `src/lib/hr-status.ts`

Add tones (reuse the existing `T` palette; `ON_HOLD` already mapped):
`OPEN`→emerald, `CLOSED`→slate, `SOURCED`→slate, `SCREENING`→blue, `SHORTLISTED`→
indigo/brand, `INTERVIEW`→amber, `OFFER`→violet, `HIRED`→emerald, `REJECTED`→rose.
One colour language via `StatusChip`, no inline colours.

## Pages (App Router, under `/hr/recruitment`)

Compose `DataTable`, `StatusChip`, `EntityLink`, `PageHeader`/`Breadcrumbs`,
`KeyValue`/`DetailSection`, Charts (`BarList`/`SegmentDonut`/`StatCard`). Each
segment gets a `loading.tsx` (shared `RouteLoading`). Seeded client forms follow
the **REMOUNT-KEY rule** (`key={id}`).

- **`/hr/recruitment`** — funnel dashboard: open positions, **total manpower
  required vs hired**, candidates-by-stage `BarList`, positions needing attention,
  recent candidates. Suspense-streamed cells.
- **`/hr/recruitment/positions`** — `DataTable`: title · department · band ·
  openings · filled (hired count) · status. Filters: `q`, `status`. Row → detail.
- `/hr/recruitment/positions/new`, `/[id]` (detail: full JD + a `StatusChip`
  summary + its candidates list), `/[id]/edit`.
- **`/hr/recruitment/candidates`** — `DataTable`: name · position (`EntityLink`) ·
  source · stage (`StatusChip`) · CV (received?) · appliedOn. Filters: `q`,
  `stage`, `source`, `positionId` (URL-as-state, `?stage=&source=&positionId=`).
- `/hr/recruitment/candidates/new`, `/[id]` (detail with inline **stage move** +
  **Convert to employee**), `/[id]/edit`.

## Convert to employee

On a candidate detail, a **Convert to employee** action (prominent when
`stage=HIRED`) links to `/hr/employees/new?name=…&mailId=…&designation=<position
title>&band=<position band>`. The new-employee page reads these query params and
seeds the `EmployeeForm` initial values (only whitelisted, known fields). The HR
user completes and saves the employee as normal. (Writing back `hiredEmployeeId`
is a follow-up nicety — not required for v1.)

## APIs — `/api/hr/recruitment/*`

- `positions` `route.ts` (GET list, POST create) + `positions/[id]/route.ts`
  (GET, PATCH, DELETE).
- `candidates` `route.ts` (GET list, POST create) + `candidates/[id]/route.ts`
  (GET, PATCH, DELETE). Stage moves go through PATCH.
- **RBAC:** `HR_VIEW` reads, `HR_WRITE` mutates, `mustChangePassword` rejected,
  **managers read-only** (excluded from write sets) — enforced in UI (`canWrite`)
  AND every mutating route. Zod is the field whitelist (`stage`/`status` are set
  only through these endpoints).

## Nav

`HR_RECRUITMENT` gains `href: "/hr/recruitment"` and drops `soon`. "Manpower
Planning" stays a stub (the manpower requirement lives on positions).

## Verification

`npx tsc --noEmit` + `npm run lint` + `npm run build`. Functional check on a fresh
e2e DB (or live after deploy): create a position, add candidates, move a candidate
through stages, and click Convert-to-employee to confirm the prefill.

## Out of scope (v1)

CV file uploads (link-only chosen); interview scheduling / feedback; offer-letter
generation; candidate emails; Manpower Planning module; writing `hiredEmployeeId`
back automatically.
