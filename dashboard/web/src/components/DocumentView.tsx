import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseCsv } from "../../../shared/csv";
import type { DocumentRec } from "../../../shared/types";
import { api } from "../lib/api";
import { fmtBytes, fmtTime } from "../lib/format";

export function DocumentView({ slug, path }: { slug: string; path: string }) {
  const [doc, setDoc] = useState<DocumentRec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setDoc(null); setErr(null);
    api.document(slug, path).then(setDoc).catch((e: Error) => setErr(e.message));
  }, [slug, path]);

  if (err) return <p className="p-4 text-sm text-rose-700">{err}</p>;
  if (!doc) return <p className="p-4 text-sm text-muted">Loading…</p>;
  const isCsv = path.endsWith(".csv");
  const isMd = path.endsWith(".md");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-slate-50 px-4 py-2 text-[12px] text-muted">
        <span className="font-mono text-ink">{doc.path}</span>
        <span>Recorded {fmtTime(doc.updatedAt)}</span>
        {doc.agent && <span>Written by {doc.agent}</span>}
        <span>{fmtBytes(doc.size)}</span>
        <span>{doc.versions} version{doc.versions === 1 ? "" : "s"}</span>
        <span className="font-mono" title="SHA-256 of the recorded content">{doc.sha256.slice(0, 12)}</span>
      </div>
      <div className="max-h-[75vh] overflow-auto px-5 py-4">
        {isCsv ? <CsvTable text={doc.content} /> : isMd ? (
          <div className="prose-report">
            <Markdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a> }}>
              {doc.content}
            </Markdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-[13px]">{doc.content}</pre>
        )}
      </div>
    </div>
  );
}

export function CsvTable({ text }: { text: string }) {
  const rows = parseCsv(text);
  if (!rows.length) return <p className="text-sm text-muted">Empty register.</p>;
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>{head.map((h, i) => <th key={i} className="sticky top-0 border border-line bg-slate-100 px-2 py-1 text-left font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-slate-50/60">
              {head.map((_, j) => <td key={j} className="border border-line px-2 py-1 align-top">{r[j]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {body.length === 0 && <p className="mt-2 text-sm text-muted">Header only — no rows recorded.</p>}
    </div>
  );
}
