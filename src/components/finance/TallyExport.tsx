"use client";
import { useEffect, useState } from "react";
import { Button, Card, CardHeader, CardBody, Field, Input } from "@/components/ui";
import Segmented from "@/components/Segmented";
import { fmtINR } from "@/lib/format";
import { Download, Info, ReceiptText, HandCoins, Layers } from "lucide-react";

type VType = "sales" | "receipts" | "both";
type Mode = "daily" | "monthly";
type Bucket = { count: number; total: number } | null;
type Counts = { sales: Bucket; receipts: Bucket };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function thisMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// The Tally export toolbar: pick Sales/Receipts/Both over a day or a month, see a
// live count/total preview, then download the Tally XML.
export default function TallyExport() {
  const [type, setType] = useState<VType>("both");
  const [mode, setMode] = useState<Mode>("monthly");
  const [day, setDay] = useState(todayISO);
  const [month, setMonth] = useState(thisMonthISO);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Inclusive [from, to] for the selected period.
  let from: string | null = null;
  let to: string | null = null;
  if (mode === "daily") {
    if (day) { from = day; to = day; }
  } else if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last of this
      from = `${month}-01`;
      to = `${month}-${pad(last)}`;
    }
  }

  const validRange = !!from && !!to;
  // The effect body only sets up a debounce timer + AbortController and returns a
  // cleanup — every setState is deferred into the timer callback, so no
  // synchronous setState runs in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!from || !to) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setErr(null);
      fetch(`/api/finance/tally/export?type=${type}&from=${from}&to=${to}&preview=1`, { signal: ctrl.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Preview failed");
          return r.json();
        })
        .then((d: Counts) => setCounts(d))
        .catch((e) => { if (e.name !== "AbortError") setErr(e.message); })
        .finally(() => setLoading(false));
    }, 200);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [type, from, to]);

  const salesN = counts?.sales?.count ?? 0;
  const receiptsN = counts?.receipts?.count ?? 0;
  const totalN = type === "sales" ? salesN : type === "receipts" ? receiptsN : salesN + receiptsN;
  const canDownload = !!from && !!to && totalN > 0;

  function download() {
    if (!from || !to) return;
    const a = document.createElement("a");
    a.href = `/api/finance/tally/export?type=${type}&from=${from}&to=${to}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Card>
      <CardHeader title="Export to Tally" subtitle="Generate Tally-compliant XML vouchers, then import them in Tally → Gateway → Import Data → Vouchers" />
      <CardBody className="space-y-5 px-6 py-5">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Vouchers</span>
            <Segmented
              ariaLabel="Voucher type"
              options={[
                { value: "sales" as VType, label: "Sales", icon: <ReceiptText className="h-3.5 w-3.5" /> },
                { value: "receipts" as VType, label: "Receipts", icon: <HandCoins className="h-3.5 w-3.5" /> },
                { value: "both" as VType, label: "Both", icon: <Layers className="h-3.5 w-3.5" /> },
              ]}
              value={type}
              onChange={setType}
              size="sm"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Period</span>
            <Segmented
              ariaLabel="Period mode"
              options={[
                { value: "monthly" as Mode, label: "Monthly" },
                { value: "daily" as Mode, label: "Daily" },
              ]}
              value={mode}
              onChange={setMode}
              size="sm"
            />
          </div>
          {mode === "daily" ? (
            <Field label="Date" htmlFor="tally-day" className="w-44">
              <Input id="tally-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
          ) : (
            <Field label="Month" htmlFor="tally-month" className="w-44">
              <Input id="tally-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
          {!validRange ? (
            <p className="text-sm text-slate-400">Select a period to preview.</p>
          ) : err ? (
            <p className="text-sm text-rose-600">{err}</p>
          ) : loading ? (
            <p className="text-sm text-slate-400">Counting vouchers…</p>
          ) : (
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {(type === "sales" || type === "both") && (
                <span className="text-slate-600">
                  <span className="font-semibold text-slate-900">{salesN}</span> sales
                  {counts?.sales && <span className="nums text-slate-400"> · {fmtINR(counts.sales.total)}</span>}
                </span>
              )}
              {(type === "receipts" || type === "both") && (
                <span className="text-slate-600">
                  <span className="font-semibold text-slate-900">{receiptsN}</span> receipts
                  {counts?.receipts && <span className="nums text-slate-400"> · {fmtINR(counts.receipts.total)}</span>}
                </span>
              )}
              {totalN === 0 && <span className="text-slate-400">No matching vouchers in this period</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={download} disabled={!canDownload}>
            <Download className="h-4 w-4" />
            Download Tally XML
          </Button>
          <span className="text-xs text-slate-400">Sales = approved invoices · Receipts = payments marked paid</span>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5 text-[12px] text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Import each period once — re-importing the same range double-posts. Party ledgers are matched by name (created in Tally if missing). Tax posts to a single GST ledger (no automatic CGST+SGST split).
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
