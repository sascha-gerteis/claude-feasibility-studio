import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api.login(username, password); onLogin(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border border-line bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-ink">Feasibility Studio</h1>
        <p className="mb-5 text-sm text-muted">Sign in to view confidential research.</p>
        <label className="mb-3 block text-sm">
          <span className="text-muted">Username</span>
          <input className="mt-1 w-full rounded border border-line px-3 py-2" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label className="mb-4 block text-sm">
          <span className="text-muted">Password</span>
          <input type="password" className="mt-1 w-full rounded border border-line px-3 py-2" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <p className="mb-3 text-sm text-rose-700">{err}</p>}
        <button disabled={busy} className="w-full rounded bg-navy py-2 text-sm font-medium text-white hover:bg-navy-2 disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
