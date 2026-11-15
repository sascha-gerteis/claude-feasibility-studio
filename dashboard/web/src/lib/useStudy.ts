import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyState } from "../../../shared/types";
import { HOSTED, api, hostedDocIds } from "./api";
import { type HostedState, subscribeStudy } from "./artifactdb";

export type StreamState = "connecting" | "connected" | "disconnected";

/**
 * Loads the derived study state and subscribes to the server's event stream.
 * The stream only says "new events/documents were recorded"; the state is then re-fetched,
 * so everything displayed is always the server's derivation of recorded data.
 */
export function useStudy(slug: string | undefined) {
  const [state, setState] = useState<StudyState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [stream, setStream] = useState<StreamState>("connecting");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const pending = useRef(false);

  const load = useCallback(async () => {
    if (!slug) return;
    if (pending.current) return;
    pending.current = true;
    try {
      const s = await api.study(slug);
      setState(s);
      setError(null);
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      setError(e as Error);
    } finally {
      pending.current = false;
    }
  }, [slug]);

  useEffect(() => {
    setState(null);
    if (HOSTED) {
      if (!slug) return;
      setStream("connecting");
      return subscribeStudy(slug, (s: HostedState) => {
        if (s.__docIds) hostedDocIds[slug] = s.__docIds;
        setState(s);
        setError(null);
        setLoadedAt(new Date().toISOString());
      }, (connected, err) => {
        setStream(connected ? "connected" : "disconnected");
        if (err) setError(err);
      });
    }
    void load();
    if (!slug || typeof EventSource === "undefined") { setStream("disconnected"); return; }
    setStream("connecting");
    const es = new EventSource(`/api/stream?study=${encodeURIComponent(slug)}`);
    es.addEventListener("hello", () => { setStream("connected"); void load(); });
    es.addEventListener("studio", () => void load());
    es.onerror = () => setStream(es.readyState === EventSource.CLOSED ? "disconnected" : "connecting");
    return () => es.close();
  }, [slug, load]);

  return { state, error, stream, loadedAt, reload: load };
}
