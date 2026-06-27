"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Card, CardHeader, CardBody, Table, thCls, tdCls, theadRowCls, trCls, Chip } from "@/components/ui";
import { AlertCircle, UserPlus } from "lucide-react";

type Row = { id: string; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean; lastLoginAt: string | null };
const ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "BD", "SCM", "PROJECT", "FINANCE", "HR"];

export default function UserAdmin({ initialUsers, meId }: { initialUsers: Row[]; meId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<Row[]>(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("BD");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers((await res.json()).users);
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, role, tempPassword }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not create user");
      setName(""); setEmail(""); setTempPassword(""); setRole("BD");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Update failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><UserPlus className="h-[18px] w-[18px] text-brand" /> Add a user</span>} subtitle="Create an account with a temporary password the user changes on first login." />
        <CardBody>
          {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <form onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" htmlFor="u-name"><Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email" htmlFor="u-email"><Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Role" htmlFor="u-role"><Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
            <Field label="Temp password" htmlFor="u-pass"><Input id="u-pass" type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} /></Field>
            <div className="flex items-end"><Button type="submit" disabled={busy} className="w-full">Create</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Users" />
        <CardBody className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <thead><tr className={theadRowCls}><th className={thCls}>Name</th><th className={thCls}>Email</th><th className={thCls}>Role</th><th className={thCls}>Status</th><th className={thCls}>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={trCls}>
                    <td className={tdCls}>{u.name}</td>
                    <td className={tdCls}><span className="text-slate-600">{u.email}</span></td>
                    <td className={tdCls}>
                      <Select value={u.role} disabled={busy || u.id === meId} onChange={(e) => patch(u.id, { role: e.target.value })} className="h-8 py-0 text-xs">
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </td>
                    <td className={tdCls}>{u.isActive ? <Chip className="bg-emerald-50 text-emerald-600">Active</Chip> : <Chip className="bg-slate-100 text-slate-400">Disabled</Chip>}</td>
                    <td className={tdCls}>
                      <div className="flex gap-2">
                        <button disabled={busy} onClick={() => { const p = prompt("New temporary password (8+ chars):"); if (p) patch(u.id, { tempPassword: p }); }} className="press text-xs font-medium text-brand-700 hover:text-brand disabled:opacity-50">Reset password</button>
                        {u.id !== meId && <button disabled={busy} onClick={() => patch(u.id, { isActive: !u.isActive })} className="press text-xs font-medium text-slate-500 hover:text-rose-600 disabled:opacity-50">{u.isActive ? "Disable" : "Enable"}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
