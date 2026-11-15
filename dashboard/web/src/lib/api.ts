import type { CompareRow, DocumentRec, StudioEvent, StudyState, StudySummary } from "../../../shared/types";

export class AuthError extends Error {}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (r.status === 401) throw new AuthError("authentication required");
  if (!r.ok) throw new Error(`${r.status} ${(await r.json().catch(() => ({}))).error ?? r.statusText}`);
  return r.json() as Promise<T>;
}

export interface Me { authEnabled: boolean; user: { username: string; role: string } | null; }

export const api = {
  me: () => get<Me>("/api/auth/me"),
  studies: () => get<StudySummary[]>("/api/studies"),
  study: (slug: string) => get<StudyState>(`/api/studies/${encodeURIComponent(slug)}`),
  events: (slug: string) => get<StudioEvent[]>(`/api/studies/${encodeURIComponent(slug)}/events`),
  document: (slug: string, path: string) =>
    get<DocumentRec>(`/api/studies/${encodeURIComponent(slug)}/document?path=${encodeURIComponent(path)}`),
  compare: (slugs: string[]) => get<CompareRow[]>(`/api/compare?studies=${slugs.map(encodeURIComponent).join(",")}`),
  login: async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "login failed");
  },
  logout: () => fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }),
};
