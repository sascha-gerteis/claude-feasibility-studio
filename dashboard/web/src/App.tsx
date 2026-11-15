import { useEffect, useState } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, matchPath, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { StudySummary } from "../../shared/types";
import { DataMode } from "./components/DataMode";
import { AuthError, api, type Me } from "./lib/api";
import { useStudy } from "./lib/useStudy";
import { AgentDetailPage } from "./pages/AgentDetail";
import { CommandCenter } from "./pages/CommandCenter";
import { LoginPage } from "./pages/Login";
import { ReportsPage } from "./pages/Reports";
import { StudiesPage } from "./pages/Studies";

export type StudyCtx = ReturnType<typeof useStudy> & { slug: string };
export const useStudyCtx = () => useOutletContext<StudyCtx>();

function Shell({ me, studies }: { me: Me; studies: StudySummary[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const slug = matchPath({ path: "/studies/:slug/*" }, pathname)?.params.slug;
  const nav = ({ isActive }: { isActive: boolean }) =>
    `rounded px-3 py-1.5 text-sm font-medium ${isActive ? "bg-white/15 text-white" : "text-slate-300 hover:text-white"}`;
  const current = slug ?? studies[0]?.slug;
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2.5">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">Feasibility Studio</span>
            <span className="text-[12px] text-slate-300">Research Command Center</span>
          </Link>
          <nav className="flex gap-1">
            {current && <NavLink end to={`/studies/${current}`} className={nav}>Command Center</NavLink>}
            <NavLink end to="/studies" className={nav}>Studies</NavLink>
            {current && <NavLink to={`/studies/${current}/reports`} className={nav}>Reports</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {studies.length > 0 && (
              <label className="flex items-center gap-2 text-[12px] text-slate-300">
                Study
                <select
                  className="max-w-[260px] rounded border border-white/20 bg-navy-2 px-2 py-1 text-[13px] text-white"
                  value={slug ?? ""}
                  onChange={(e) => navigate(`/studies/${e.target.value}`)}
                >
                  {!slug && <option value="">Select…</option>}
                  {studies.map((s) => <option key={s.slug} value={s.slug}>{s.name}{s.kind === "validation" ? " (validation)" : ""}</option>)}
                </select>
              </label>
            )}
            {me.authEnabled && me.user && (
              <button type="button" className="text-[12px] text-slate-300 hover:text-white"
                onClick={async () => { await api.logout(); window.location.assign("/login"); }}>
                {me.user.username} · Sign out
              </button>
            )}
            {!me.authEnabled && <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-200" title="Browser authentication is disabled because the server only listens on a loopback address">Local mode</span>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-5 py-5">
        <Outlet />
      </main>
    </div>
  );
}

function StudyScope() {
  const { slug = "" } = useParams();
  const s = useStudy(slug);
  if (s.error && !s.state) {
    return <p className="rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{s.error.message}</p>;
  }
  return (
    <div className="space-y-4">
      <DataMode state={s.state} stream={s.stream} loadedAt={s.loadedAt} />
      {s.state ? <Outlet context={{ ...s, slug }} /> : <p className="text-sm text-muted">Loading recorded study data…</p>}
    </div>
  );
}

function Home({ studies }: { studies: StudySummary[] }) {
  const pick = studies.find((s) => s.active) ?? studies.find((s) => s.kind === "study") ?? studies[0];
  return pick ? <Navigate to={`/studies/${pick.slug}`} replace /> : <Navigate to="/studies" replace />;
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [studies, setStudies] = useState<StudySummary[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const m = await api.me();
      setMe(m);
      if (m.authEnabled && !m.user) { setNeedLogin(true); return; }
      setNeedLogin(false);
      setStudies(await api.studies());
    } catch (e) {
      if (e instanceof AuthError) setNeedLogin(true); else setErr((e as Error).message);
    }
  };
  useEffect(() => { void refresh(); }, []);

  if (err) return <p className="m-6 rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">Cannot reach the dashboard server: {err}</p>;
  if (needLogin) return <LoginPage onLogin={refresh} />;
  if (!me || !studies) return <p className="m-6 text-sm text-muted">Loading…</p>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<Shell me={me} studies={studies} />}>
          <Route index element={<Home studies={studies} />} />
          <Route path="studies" element={<StudiesPage studies={studies} onRefresh={refresh} />} />
          <Route path="studies/:slug" element={<StudyScope />}>
            <Route index element={<CommandCenter />} />
            <Route path="agents/:name" element={<AgentDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
