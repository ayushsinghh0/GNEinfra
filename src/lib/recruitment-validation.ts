import { z } from "zod";

// Shared enums/lists — one source of truth for the client forms + server routes.
export const POSITION_STATUSES = ["OPEN", "ON_HOLD", "CLOSED"] as const;
export const HIRING_STAGES = [
  "SOURCED", "SCREENING", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "ON_HOLD",
] as const;
export const CANDIDATE_SOURCES = [
  "Referral", "Job Portal", "Agency", "LinkedIn", "Website", "Walk-in", "Other",
] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Contract", "Intern", "Consultant"] as const;

// Human labels for the pipeline stages (the enum values are SCREAMING_CASE).
export const HIRING_STAGE_LABELS: Record<(typeof HIRING_STAGES)[number], string> = {
  SOURCED: "Sourced",
  SCREENING: "Screening",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
  ON_HOLD: "On hold",
};
export const POSITION_STATUS_LABELS: Record<(typeof POSITION_STATUSES)[number], string> = {
  OPEN: "Open",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);

export const positionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  code: z.string().trim().max(40).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  band: z.string().trim().max(40).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  employmentType: z.string().trim().max(60).optional().or(z.literal("")),
  openings: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 1 : v),
    z.coerce.number({ invalid_type_error: "Enter digits only" }).int("Whole number only").min(0, "Cannot be negative").max(10000)
  ),
  jobDescription: z.string().trim().max(8000).optional().or(z.literal("")),
  status: z.enum(POSITION_STATUSES).default("OPEN"),
});
export type PositionInput = z.infer<typeof positionSchema>;

export const candidateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  email: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  positionId: z.string().trim().optional().or(z.literal("")),
  source: z.string().trim().max(60).optional().or(z.literal("")),
  stage: z.enum(HIRING_STAGES).default("SOURCED"),
  cvReceived: z.coerce.boolean().optional(),
  cvLink: z.string().trim().max(500).optional().or(z.literal("")),
  experienceYears: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number({ invalid_type_error: "Enter a number" }).min(0, "Cannot be negative").max(60).optional()
  ),
  noticePeriod: z.string().trim().max(60).optional().or(z.literal("")),
  appliedOn: optDate,
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type CandidateInput = z.infer<typeof candidateSchema>;

// Just the stage — for the inline stage-move control on a candidate.
export const stageSchema = z.object({ stage: z.enum(HIRING_STAGES) });
