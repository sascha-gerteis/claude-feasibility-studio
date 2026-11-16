import { useEffect, useRef, useState, type ReactNode } from "react";
import { HOSTED, api } from "../lib/api";
import { DocumentView } from "./DocumentView";

/* eslint-disable @typescript-eslint/no-explicit-any */
let downloadsPromise: Promise<any | null> | null = null;
function hostedDownloads(): Promise<any | null> {
  if (!downloadsPromise) {
    const c = (window as any).claude;
    downloadsPromise = c?.use ? c.use("downloads").catch(() => null) : Promise.resolve(null);
  }
  return downloadsPromise!;
}

/** Downloads a stored document. Hosted: the claude.ai save prompt. Self-served: an authenticated attachment. */
export function DownloadButton({ slug, path, label = "Download", className = "" }: { slug: string; path: string; label?: string; className?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    if (HOSTED) void hostedDownloads().then((d) => setAvailable(Boolean(d)));
  }, []);
  const filename = `${slug}__${path.split("/").slice(-1)[0]}`;
  const cls = `inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`;
  if (!HOSTED) {
    return <a className={cls} href={`/api/studies/${encodeURIComponent(slug)}/download?path=${encodeURIComponent(path)}`} download={filename}>⤓ {label}</a>;
  }
  if (!available) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={cls} onClick={async () => {
        setMsg(null);
        try {
          const d = await hostedDownloads();
          const doc = await api.document(slug, path);
          await d.save({ filename, data: doc.content });
          setMsg("Saved");
        } catch (e) {
          const code = (e as { code?: string }).code;
          setMsg(code === "declined" ? null : code === "rate_limited" ? "A save prompt is already open" : "Download is not available here");
        }
      }}>⤓ {label}</button>
      {msg && <span className="text-xs text-muted" role="status">{msg}</span>}
    </span>
  );
}

/** Modal reader for a full document, with download. */
export function ReportReader({ slug, path, title, onClose }: { slug: string; path: string; title: string; onClose: () => void }) {
  return (
    <Dialog title={title} onClose={onClose} wide actions={<DownloadButton slug={slug} path={path} />}>
      <DocumentView slug={slug} path={path} />
    </Dialog>
  );
}

export function Dialog({ title, onClose, children, actions, wide = false }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        className={`flex h-full w-full flex-col bg-canvas shadow-2xl outline-none ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <h2 className="min-w-0 truncate text-lg font-semibold text-ink">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-ink" aria-label="Close">✕ Close</button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
