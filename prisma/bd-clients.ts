// The 40 clients from the "Client list" sheet of the GNE BD Tracker workbook,
// used by prisma/seed.ts to bootstrap the BD module (only when BdClient is
// empty, so re-seeding never duplicates or clobbers edits made in the app).
import type { Prisma } from "@prisma/client";

type Row = [name: string, industry: string, service: "EPC" | "OM" | "EPC_OM", plant: "" | "GROUND" | "ROOF"];

const ROWS: Row[] = [
  ["Bondada", "Renewable", "EPC", "GROUND"],
  ["JMB", "Renewable", "OM", "ROOF"],
  ["Jakson", "Renewable", "OM", "ROOF"],
  ["Onix Renewable", "Renewable", "EPC_OM", "GROUND"],
  ["Jindal India Renewable Energy Ltd", "Renewable", "EPC_OM", "GROUND"],
  ["Sarala Project Work", "Renewable", "EPC_OM", "GROUND"],
  ["Pace Digitck", "Renewable", "EPC_OM", "GROUND"],
  ["Oriana Power", "Renewable", "EPC_OM", "GROUND"],
  ["Renew Solar Power (P) Ltd", "Renewable", "EPC_OM", "GROUND"],
  ["Adani Renewable Energy Holding Nine Ltd", "Renewable", "EPC_OM", "GROUND"],
  ["NTPC Re Ltd", "Renewable", "EPC_OM", "GROUND"],
  ["UPNADA", "Govt", "EPC_OM", "ROOF"],
  ["Enrich Energy (P) Ltd", "Renewable", "EPC_OM", ""],
  ["Manchanda Renewable (P) Ltd", "Renewable", "OM", "ROOF"],
  ["Kolar Solar Power (P) Ltd", "Renewable", "OM", ""],
  ["Jayram Industries India (P) Ltd", "Renewable", "OM", ""],
  ["Seftech", "Renewable", "OM", ""],
  ["Enerture", "Renewable", "OM", ""],
  ["DEPL", "Renewable", "EPC_OM", ""],
  ["Chark", "Renewable", "EPC_OM", ""],
  ["BEL", "Renewable", "EPC_OM", ""],
  ["Prozeal", "Renewable", "EPC_OM", ""],
  ["Syogs Lyod", "Renewable", "EPC_OM", ""],
  ["Freyr Energy", "O&M", "OM", ""],
  ["Mysun", "O&M", "OM", ""],
  ["Solar Square", "O&M", "OM", ""],
  ["Oorjan Cleantech", "O&M", "OM", ""],
  ["SunSource Energy", "O&M", "OM", ""],
  ["Hartek Group", "O&M", "OM", ""],
  ["Loom Solar", "O&M", "OM", ""],
  ["Azure Power", "O&M", "OM", ""],
  ["Solluz Energy Pvt Ltd", "O&M", "OM", ""],
  ["Advit Venture Pvt Ltd", "O&M", "OM", ""],
  ["Gewis Renewpower", "O&M", "OM", ""],
  ["Array Energy Solution", "O&M", "OM", ""],
  ["Australian Premium Solar", "O&M", "OM", ""],
  ["Mitresh Energy Pvt Ltd", "O&M", "OM", ""],
  ["Inox Clean Energy", "O&M", "OM", ""],
  ["Emmvee Solar", "O&M", "OM", ""],
  ["OMC Power", "O&M", "OM", ""],
];

export const BD_CLIENTS: Prisma.BdClientCreateManyInput[] = ROWS.map(([name, industry, service, plant]) => ({
  name,
  industry,
  serviceType: service,
  plantType: plant || null,
}));
