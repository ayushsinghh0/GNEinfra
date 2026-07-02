// Static company details printed on document headers (salary slip, tax
// invoice, NOPA, approval note). Values come from the GNE invoice format.
export const COMPANY = {
  name: "Green Next Energy Infra Pvt. Ltd.",
  addressLines: [
    "Flat No. C-3/8, DDA Flat, Near Krishna Cyber Café",
    "New Delhi – 110065, India",
  ],
  pan: "AALCG5876C",
  gstin: "07AALCG5876C1ZD",
  cin: "", // CIN (not on the invoice format — fill when available)
  email: "vinod.saini@gneinfra.com",
  phone: "9958002517",
  bank: {
    name: "HDFC Bank",
    accountNo: "50200102008242",
    ifsc: "HDFC0000483",
  },
} as const;
