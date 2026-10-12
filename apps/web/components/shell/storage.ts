import { useMemo, useSyncExternalStore } from "react";

/**
 * Per-viewer UI preferences in localStorage (sidebar state, pins, recents, last visits).
 * Storage can be missing or throw (private mode, blocked site data), so every access is guarded
 * and the shell works without it.
 */
function getRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = getRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const listeners = new Set<() => void>();

export function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences are a convenience; ignore quota or privacy errors.
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * A stored preference, parsed and validated. The server render (and a browser without storage)
 * sees `fallback`; the stored value appears after hydration and follows writes from any tab.
 */
export function useStored<T>(key: string, parse: (v: unknown) => T, fallback: T): T {
  const raw = useSyncExternalStore(
    subscribe,
    () => getRaw(key),
    () => null,
  );
  return useMemo(() => {
    if (raw === null) return fallback;
    try {
      return parse(JSON.parse(raw));
    } catch {
      return fallback;
    }
    // `parse` and `fallback` are constants at the call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
}

export const asStrings = (v: unknown, max = 50): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : [];

export const storageKeys = {
  collapsed: "zf.sidebar.collapsed",
  groups: "zf.sidebar.closedGroups",
  pins: (ws: string) => `zf.sidebar.pins.${ws}`,
  recent: (ws: string) => `zf.palette.recent.${ws}`,
  ordersSeen: (ws: string) => `zf.orders.lastVisit.${ws}`,
};
