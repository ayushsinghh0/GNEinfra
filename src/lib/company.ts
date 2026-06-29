// Static company details printed on the salary slip header.
// Replace placeholder values with the real registered-office details.
export const COMPANY = {
  name: "GNE Infra",
  addressLines: [
    "Registered Office address line 1",
    "City, State – PIN",
  ],
  pan: "",       // company PAN, e.g. "AAAAA0000A"
  gstin: "",     // GSTIN
  cin: "",       // CIN
  email: "",     // HR/payroll contact email
  phone: "",     // contact phone
} as const;
