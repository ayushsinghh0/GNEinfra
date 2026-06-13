"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Login failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 p-8"
      >
        <div className="w-12 h-12 rounded-lg bg-brand text-white grid place-items-center font-bold mb-5">
          GNE
        </div>
        <h1 className="text-xl font-bold text-slate-900">Admin Login</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          Enter the procurement admin password.
        </p>
        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full py-2.5 rounded-lg bg-brand text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
