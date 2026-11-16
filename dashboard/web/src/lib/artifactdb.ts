// Data source for the hosted build (a private claude.ai artifact).
// The orchestrating Claude session writes snapshots derived from recorded hook events into the
// artifact's database (see `studio.py artifact-export`); this page reads them and re-renders the
// moment a new snapshot is written. Nothing here invents or interpolates data.
import type { CompareRow, DocumentRec, StudyState, StudySummary } from "../../../shared/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;
let dbPromise: Promise<Db | null> | null = null;

export function getDb(): Promise<Db | null> {
  if (!dbPromise) {
    const c = (window as any).claude;
    dbPromise = c?.use ? c.use("db").catch(() => null) : Promise.resolve(null);
  }
  return dbPromise!;
}

export interface SyncInfo { syncedAt: string; eventsThrough: string | null; source: string; }
export type HostedState = StudyState & { __sync?: SyncInfo; __docIds?: Record<string, string> };

async function need(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new Error("The dashboard's data store is unavailable in this view. Open the artifact on claude.ai while signed in.");
  return db;
}

export async function hostedStudies(): Promise<StudySummary[]> {
  const db = await need();
  const snap = await db.collection("studies").get();
  return snap.docs.map((d: any) => d.data() as StudySummary)
    .sort((a: StudySummary, b: StudySummary) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
}

export function subscribeStudy(
  slug: string,
  onState: (s: HostedState) => void,
  onStatus: (connected: boolean, err?: Error) => void,
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  const timer = setTimeout(() => onStatus(false, new Error("The data store has not answered yet.")), 10_000);
  void getDb().then((db) => {
    if (cancelled) return;
    if (!db) { clearTimeout(timer); onStatus(false, new Error("The dashboard's data store is unavailable in this view.")); return; }
    unsub = db.doc(`states/${slug}`).onSnapshot(
      (snap: any) => {
        if (!snap.metadata.fromCache) clearTimeout(timer);
        if (!snap.exists) { onStatus(!snap.metadata.fromCache, new Error("No synced data for this study yet.")); return; }
        onState(snap.data() as HostedState);
        onStatus(!snap.metadata.fromCache);
      },
      (e: any) => { clearTimeout(timer); onStatus(false, new Error(e?.message ?? "Data store error")); },
    );
  });
  return () => { cancelled = true; clearTimeout(timer); unsub?.(); };
}

export async function hostedDocument(slug: string, path: string, docIds: Record<string, string> | undefined): Promise<DocumentRec> {
  const db = await need();
  const id = docIds?.[path];
  if (!id) throw new Error("This document has not been synced to the hosted dashboard.");
  const snap = await db.doc(`documents/${id}`).get();
  if (!snap.exists) throw new Error("This document has not been synced to the hosted dashboard.");
  const d = snap.data() as DocumentRec & { parts?: number };
  if (d.parts && d.parts > 0) {
    const chunks: string[] = [];
    for (let i = 0; i < d.parts; i++) {
      const p = await db.doc(`docparts/${id}-${i}`).get();
      chunks.push(p.exists ? String((p.data() as { text: string }).text) : "");
    }
    return { ...d, content: chunks.join("") };
  }
  return d;
}

export async function hostedCompare(slugs: string[]): Promise<CompareRow[]> {
  const db = await need();
  const rows = await Promise.all(slugs.map(async (s) => {
    const snap = await db.doc(`compare/${s}`).get();
    return snap.exists ? (snap.data() as CompareRow) : null;
  }));
  return rows.filter((r): r is CompareRow => r !== null);
}
