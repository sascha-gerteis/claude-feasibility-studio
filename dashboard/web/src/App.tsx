import { useEffect, useState } from "react";
import {
  BrowserRouter, Link, MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, matchPath, useLocation, useNavigate,
  useOutletContext, useParams, useSearchParams,
} from "react-router-dom";
import type { StudySummary } from "../../shared/types";
import { AgentDrawer } from "./components/AgentDrawer";
import { Dialog } from "./components/Reports";
import { AuthError, HOSTED, api, type Me } from "./lib/api";
import { AGENT_META } from "./lib/agents";
import { fmtTime } from "./lib/format";
import { useStudy } from "./lib/useStudy";
import { LoginPage } from "./pages/Login";
import { OfficePage } from "./pages/Office";
import { StudiesPage } from "./pages/Studies";
import { TechnicalPage } from "./pages/Technical";
import { AgentsPage, FindingsPage, FinalReportPage } from "./pages/Views";

export type StudyCtx = ReturnType<typeof useStudy> & { slug: string };
export const useStudyCtx = () => useOutletContext<StudyCtx>();

/** Plain #name deep links for the hosted page (artifact links carry only #name). */
const VIEW_FOR_HASH: Record<string, string> = { overview: "", agents: "agents", findings: "findings", "final-report": "final", technical: "technical" };
const HASH_FOR_VIEW: Record<string, string> = { "": "overview", agents: "agents", findings: "findings", final: "final-report", technical: "technical" };

function defaultStudy(studies: StudySummary[]): StudySummary | undefined {
  return studies.find((s) => s.active && s.kind === "study") ?? studies.find((s) => s.kind === "study") ?? studies.find((s) => s.active) ?? studies[0];
}

function initialEntry(studies: StudySummary[]): string {
  const pick = defaultStudy(studies);
  if (!pick) return "/studies";
  const h = (() => { try { return window.location.hash.replace(/^#/, ""); } catch { return ""; } })();
  if (h.startsWith("agent-") && AGENT_META[h.slice(6)]) return `/studies/${pick.slug}?agent=${h.slice(6)}`;
  if (h in VIEW_FOR_HASH) return `/studies/${pick.slug}${VIEW_FOR_HASH[h] ? "/" + VIEW_FOR_HASH[h] : ""}`;
  return `/studies/${pick.slug}`;
}

function HashSync() {
  const loc = useLocation();
  useEffect(() => {
    if (!HOSTED) return;
    const m = matchPath({ path: "/studies/:slug/:view?" }, loc.pathname);
    const agent = new URLSearchParams(loc.search).get("agent");
    const name = agent ? `agent-${agent}` : m ? HASH_FOR_VIEW[m.params.view ?? ""] : undefined;
    try { if (name) window.history.replaceState(null, "", `#${name}`); } catch { /* the viewer may not allow it */ }
  }, [loc]);
  return null;
}

function Shell({ me, studies }: { me: Me; studies: StudySummary[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const slug = matchPath({ path: "/studies/:slug/*" }, pathname)?.params.slug;
  const current = slug ?? defaultStudy(studies)?.slug;
  const nav = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-white text-navy" : "text-slate-200 hover:bg-white/10 hover:text-white"}`;
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link to={current ? `/studies/${current}` : "/"} className="flex items-baseline gap-2">
            <span className="text-[16px] font-semibold tracking-tight">Feasibility Studio</span>
            <span className="hidden text-[12px] text-slate-300 sm:inline">Research Office</span>
          </Link>
          {current && (
            <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1" aria-label="Primary">
              <NavLink end to={`/studies/${current}`} className={nav}>Overview</NavLink>
              <NavLink to={`/studies/${current}/agents`} className={nav}>Agents</NavLink>
              <NavLink to={`/studies/${current}/findings`} className={nav}>Research Findings</NavLink>
              <NavLink to={`/studies/${current}/final`} className={nav}>Final Report</NavLink>
            </nav>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {studies.length > 1 && (
              <label className="flex items-center gap-2 text-[12px] text-slate-300">
                <span className="sr-only sm:not-sr-only">Study</span>
                <select className="max-w-[240px] rounded-md border border-white/20 bg-navy-2 px-2 py-1 text-[13px] text-white"
                  value={slug ?? ""} onChange={(e) => navigate(`/studies/${e.target.value}`)}>
                  {!slug && <option value="">Select…</option>}
                  {studies.map((s) => <option key={s.slug} value={s.slug}>{s.name}{s.kind === "validation" ? " (test data)" : ""}</option>)}
                </select>
              </label>
            )}
            {current && <NavLink to={`/studies/${current}/technical`} className="text-[12px] text-slate-300 underline-offset-2 hover:text-white hover:underline">Technical details</NavLink>}
            {me.authEnabled && me.user && (
              <button type="button" className="text-[12px] text-slate-300 hover:text-white" onClick={async () => { await api.logout(); window.location.assign("/login"); }}>
                {me.user.username} · Sign out
              </button>
            )}
            {HOSTED && <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-200" title="Hosted as a private claude.ai page; access follows its Share settings">Private</span>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function BlockersDialog({ ctx, onClose }: { ctx: StudyCtx; onClose: () => void }) {
  const b = ctx.state?.blockers ?? [];
  return (
    <Dialog title="Open blockers" onClose={onClose}>
      <div className="space-y-2 p-5">
        {b.length === 0 && <p className="text-sm text-muted">No blockers recorded.</p>}
        {b.map((x, i) => (
          <div key={i} className="rounded-lg border border-rose-200 bg-white p-3 text-sm">
            <p className="font-semibold text-ink">{x.agent ? AGENT_META[x.agent]?.role ?? x.agent : "Study"}</p>
            <p className="text-ink">{x.message}</p>
            {x.ts && <p className="text-xs text-muted">{fmtTime(x.ts)}</p>}
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function StudyScope() {
  const { slug = "" } = useParams();
  const s = useStudy(slug);
  const [params, setParams] = useSearchParams();
  const agentName = params.get("agent");
  const ctx: StudyCtx = { ...s, slug };
  const close = () => { const p = new URLSearchParams(params); p.delete("agent"); p.delete("blockers"); setParams(p); };
  if (s.error && !s.state) {
    return <p className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{s.error.message}</p>;
  }
  const agent = agentName ? s.state?.agents.find((a) => a.name === agentName) : undefined;
  return (
    <div className="space-y-5">
      {s.state?.study.kind === "validation" && (
        <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 border-dashed border-violet-400 bg-violet-50 px-3 py-2 text-sm text-violet-950">
          <span className="rounded bg-violet-700 px-2 py-0.5 text-xs font-bold tracking-wider text-white">TEST DATA</span>
          <span>A recorded <b>validation run</b> of the agent system. The finished tasks were harmless smoke tests, <b>not feasibility reports</b>. There are no findings or recommendation here.</span>
        </div>
      )}
      {s.state ? <Outlet context={ctx} /> : <p className="text-sm text-muted">Loading recorded study data…</p>}
      {agent && s.state && <AgentDrawer agent={agent} state={s.state} slug={slug} onClose={close} />}
      {params.get("blockers") && <BlockersDialog ctx={ctx} onClose={close} />}
    </div>
  );
}

function Home({ studies }: { studies: StudySummary[] }) {
  const pick = defaultStudy(studies);
  return pick ? <Navigate to={`/studies/${pick.slug}`} replace /> : <Navigate to="/studies" replace />;
}

function LegacyAgent() {
  const { slug, name } = useParams();
  return <Navigate to={`/studies/${slug}?agent=${name}`} replace />;
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

  if (err) return <p className="m-6 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{HOSTED ? "Cannot load the research data" : "Cannot reach the dashboard server"}: {err}</p>;
  if (needLogin) return <LoginPage onLogin={refresh} />;
  if (!me || !studies) return <p className="m-6 text-sm text-muted">Loading…</p>;

  const routes = (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Shell me={me} studies={studies} />}>
        <Route index element={<Home studies={studies} />} />
        <Route path="studies" element={<StudiesPage studies={studies} onRefresh={refresh} />} />
        <Route path="studies/:slug" element={<StudyScope />}>
          <Route index element={<OfficePage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/:name" element={<LegacyAgent />} />
          <Route path="findings" element={<FindingsPage />} />
          <Route path="final" element={<FinalReportPage />} />
          <Route path="technical" element={<TechnicalPage studies={studies} onRefresh={refresh} />} />
          <Route path="reports" element={<Navigate to="../technical?tab=files" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
  // Artifact links only carry a plain #name, so the hosted build routes in memory and mirrors the view into #name.
  return HOSTED
    ? <MemoryRouter initialEntries={[initialEntry(studies)]}><HashSync />{routes}</MemoryRouter>
    : <BrowserRouter>{routes}</BrowserRouter>;
}
