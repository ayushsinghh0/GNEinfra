"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  Input,
  Select,
  Card,
  CardHeader,
  CardBody,
  Chip,
  StatCard,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  AlertCircle,
  UserPlus,
  Users,
  UserCheck,
  UserX,
  KeyRound,
} from "lucide-react";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

const ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "BD", "SCM", "PROJECT", "FINANCE", "HR"];
const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  BD: "BD",
  SCM: "SCM",
  PROJECT: "Project",
  FINANCE: "Finance",
  HR: "HR",
};

function fmtLastLogin(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function UserAdmin({ initialUsers, meId }: { initialUsers: Row[]; meId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<Row[]>(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("BD");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset-password dialog (replaces the old window.prompt()).
  const [resetUser, setResetUser] = useState<Row | null>(null);
  const [resetPass, setResetPass] = useState("");
  // Disable-account confirmation (locking someone out deserves a pause).
  const [disableUser, setDisableUser] = useState<Row | null>(null);

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
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, tempPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not create user");
      setName("");
      setEmail("");
      setTempPassword("");
      setRole("BD");
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
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Update failed");
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const active = users.filter((u) => u.isActive).length;
  const disabled = users.length - active;
  const pendingFirstLogin = users.filter((u) => u.isActive && u.mustChangePassword).length;

  const columns: Column<Row>[] = [
    {
      key: "user",
      header: "User",
      titleInCard: true,
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={u.name} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-slate-800">{u.name}</span>
              {u.id === meId && <Chip className="bg-brand-50 text-brand-700">You</Chip>}
            </span>
            <span className="block truncate text-xs text-slate-500">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      cardLabel: "Role",
      cell: (u) => (
        <Select
          value={u.role}
          disabled={busy || u.id === meId}
          onChange={(e) => patch(u.id, { role: e.target.value })}
          aria-label={`Role for ${u.name}`}
          className="h-9 w-auto min-w-28 py-0 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      cell: (u) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {u.isActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
              Disabled
            </span>
          )}
          {u.isActive && u.mustChangePassword && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <KeyRound className="h-3 w-3" aria-hidden="true" />
              First login pending
            </span>
          )}
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Last login",
      priority: "lg",
      cardLabel: "Last login",
      cell: (u) =>
        u.lastLoginAt ? (
          <span className="nums text-xs text-slate-500">{fmtLastLogin(u.lastLoginAt)}</span>
        ) : (
          <span className="text-xs text-slate-400">Never</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cardLabel: "Actions",
      cell: (u) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setResetPass("");
              setResetUser(u);
            }}
          >
            Reset password
          </Button>
          {u.id !== meId &&
            (u.isActive ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => setDisableUser(u)}
              >
                Disable
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-emerald-700 hover:bg-emerald-50"
                onClick={() => patch(u.id, { isActive: true })}
              >
                Enable
              </Button>
            ))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Account health at a glance */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total accounts" value={users.length} tone="brand" icon={<Users className="h-[18px] w-[18px]" />} />
        <StatCard label="Active" value={active} tone="emerald" icon={<UserCheck className="h-[18px] w-[18px]" />} />
        <StatCard label="Awaiting first login" value={pendingFirstLogin} tone="amber" icon={<KeyRound className="h-[18px] w-[18px]" />} />
        <StatCard label="Disabled" value={disabled} tone="slate" icon={<UserX className="h-[18px] w-[18px]" />} />
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <UserPlus className="h-[18px] w-[18px] text-brand" /> Add a user
            </span>
          }
          subtitle="Create an account with a temporary password — the user sets their own on first login."
        />
        <CardBody>
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={create} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" htmlFor="u-name">
              <Input id="u-name" required value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Email" htmlFor="u-email">
              <Input id="u-email" type="email" required value={email} autoComplete="off" onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </Field>
            <Field label="Role" htmlFor="u-role">
              <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Temp password" hint="8+ chars" htmlFor="u-pass">
              <Input
                id="u-pass"
                type="password"
                required
                minLength={8}
                value={tempPassword}
                autoComplete="new-password"
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={busy} className="w-full">
                <UserPlus className="h-4 w-4" />
                Create
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Accounts" subtitle={`${users.length} staff account(s)`} />
        <DataTable
          rows={users}
          columns={columns}
          rowKey={(u) => u.id}
          empty={
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No accounts yet"
              description="Create the first staff account above."
            />
          }
        />
      </Card>

      {/* Reset-password dialog — replaces the old browser prompt(). */}
      <ConfirmDialog
        open={resetUser !== null}
        title="Reset password"
        message={
          resetUser
            ? `Set a temporary password for ${resetUser.name}. They'll be asked to change it at their next sign-in.`
            : undefined
        }
        confirmLabel="Reset password"
        busy={busy}
        onCancel={() => setResetUser(null)}
        onConfirm={async () => {
          if (!resetUser || resetPass.length < 8) return;
          const ok = await patch(resetUser.id, { tempPassword: resetPass });
          if (ok) setResetUser(null);
        }}
      >
        <Field
          label="Temporary password"
          hint="8+ characters"
          htmlFor="reset-pass"
          error={resetPass.length > 0 && resetPass.length < 8 ? "Must be at least 8 characters." : undefined}
        >
          <Input
            id="reset-pass"
            type="password"
            autoFocus
            autoComplete="new-password"
            value={resetPass}
            onChange={(e) => setResetPass(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
      </ConfirmDialog>

      {/* Disable-account confirmation */}
      <ConfirmDialog
        open={disableUser !== null}
        title="Disable account?"
        message={
          disableUser
            ? `${disableUser.name} (${disableUser.email}) will no longer be able to sign in. You can re-enable them any time.`
            : undefined
        }
        confirmLabel="Disable account"
        variant="danger"
        busy={busy}
        onCancel={() => setDisableUser(null)}
        onConfirm={async () => {
          if (!disableUser) return;
          const ok = await patch(disableUser.id, { isActive: false });
          if (ok) setDisableUser(null);
        }}
      />
    </div>
  );
}
