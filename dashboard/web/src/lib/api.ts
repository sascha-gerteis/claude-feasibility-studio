import type { CompareRow, DocumentRec, StudioEvent, StudyState, StudySummary } from "../../../shared/types";
import { hostedCompare, hostedDocument, hostedStudies } from "./artifactdb";

/** True in the hosted build (private claude.ai artifact); false when served by the dashboard server. */
export const HOSTED = import.meta.env.VITE_TARGET === "artifact";
/** path -> artifact document id, per study; filled from each synced state. */
export const hostedDocIds: Record<string, Record<string, string>> = {};

export class AuthError extends Error {}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (r.status === 401) throw new AuthError("authentication required");
  if (!r.ok) throw new Error(`${r.status} ${(await r.json().catch(() => ({}))).error ?? r.statusText}`);
  return r.json() as Promise<T>;
}

export interface Me { authEnabled: boolean; user: { username: string; role: string } | null; }

export const api = {
  me: (): Promise<Me> => (HOSTED ? Promise.resolve({ authEnabled: false, user: null }) : get<Me>("/api/auth/me")),
  studies: () => (HOSTED ? hostedStudies() : get<StudySummary[]>("/api/studies")),
  study: (slug: string) => get<StudyState>(`/api/studies/${encodeURIComponent(slug)}`),
  events: (slug: string) => get<StudioEvent[]>(`/api/studies/${encodeURIComponent(slug)}/events`),
  document: (slug: string, path: string) => (HOSTED ? hostedDocument(slug, path, hostedDocIds[slug]) :
    get<DocumentRec>(`/api/studies/${encodeURIComponent(slug)}/document?path=${encodeURIComponent(path)}`)),
  compare: (slugs: string[]) => (HOSTED ? hostedCompare(slugs) :
    get<CompareRow[]>(`/api/compare?studies=${slugs.map(encodeURIComponent).join(",")}`)),
  login: async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "login failed");
  },
  logout: () => fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }),
};
