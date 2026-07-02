// Prisma `data` shapes for BD create/update routes — one mapping shared by
// POST and PATCH so both write identical shapes ("" → null, ISO string → Date).
import type { ClientInput, EnquiryInput, BdPoInput, TargetInput } from "@/lib/bd-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

export function clientData(d: ClientInput) {
  return {
    name: d.name,
    industry: d.industry || null,
    serviceType: d.serviceType ?? null,
    plantType: d.plantType ?? null,
    contactPerson: d.contactPerson || null,
    contactNumber: d.contactNumber || null,
    notes: d.notes || null,
  };
}

export function enquiryData(d: EnquiryInput) {
  return {
    fiscalYear: d.fiscalYear,
    enquiryDate: toDate(d.enquiryDate),
    enquiryType: d.enquiryType || null,
    clientId: d.clientId,
    personName: d.personName || null,
    contactNo: d.contactNo || null,
    location: d.location || null,
    projectType: d.projectType || null,
    activities: d.activities || null,
    unit: d.unit || null,
    qty: d.qty ?? null,
    quoteNo: d.quoteNo || null,
    submissionDate: toDate(d.submissionDate),
    projectStatus: d.projectStatus || null,
    probabilityPct: d.probabilityPct ?? null,
    forecastedRevenue: d.forecastedRevenue ?? null,
    stage: d.stage,
    expectedClosure: toDate(d.expectedClosure),
    finalStatus: d.finalStatus,
    customerContact: d.customerContact || null,
    value: d.value ?? null,
    notes: d.notes || null,
  };
}

export function poData(d: BdPoInput) {
  return {
    fiscalYear: d.fiscalYear,
    receivedDate: toDate(d.receivedDate),
    projectType: d.projectType || null,
    clientId: d.clientId,
    activities: d.activities || null,
    quoteNo: d.quoteNo || null,
    enquiryId: d.enquiryId ?? null,
    projectQty: d.projectQty || null,
    projectPeriod: d.projectPeriod || null,
    poNumber: d.poNumber || null,
    poValue: d.poValue ?? null,
    poDate: toDate(d.poDate),
    poStart: toDate(d.poStart),
    poEnd: toDate(d.poEnd),
    remarks: d.remarks || null,
  };
}

export function targetData(d: TargetInput) {
  return {
    fiscalYear: d.fiscalYear,
    quarter: d.quarter ?? null,
    states: d.states || null,
    keyAccountPerson: d.keyAccountPerson || null,
    project: d.project || null,
    serviceType: d.serviceType ?? null,
    plantType: d.plantType ?? null,
    projectSize: d.projectSize || null,
    locations: d.locations ?? null,
    estimatedValue: d.estimatedValue ?? null,
    probabilityPct: d.probabilityPct ?? null,
    forecastedRevenue: d.forecastedRevenue ?? null,
    orderReceived: d.orderReceived ?? null,
    notes: d.notes || null,
  };
}
