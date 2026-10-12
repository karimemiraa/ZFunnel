"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { markNotificationsRead, pollShell, type ShellPoll } from "@/lib/shell-actions";
import { asStrings, readJson, storageKeys, useStored, writeJson } from "./storage";

const NONE: string[] = [];

export type ShellWorkspace = { slug: string; name: string };
export type ShellWorkspaceGroup = { organizationName: string; workspaces: ShellWorkspace[] };

type ShellState = {
  workspaceSlug: string;
  workspaceGroups: ShellWorkspaceGroup[];
  /** Icon-only sidebar. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  closedGroups: string[];
  toggleGroup: (id: string) => void;
  pins: string[];
  togglePin: (segment: string) => void;
  poll: ShellPoll | null;
  refreshPoll: () => void;
  markRead: (ids?: string[]) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
};

const Ctx = createContext<ShellState | null>(null);

export function useShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShell outside ShellProvider");
  return ctx;
}

/** Polling interval for badges and notifications (ROADMAP 8.5i: ~60s is fine). */
const POLL_MS = 60_000;

export function ShellProvider({
  workspaceSlug,
  workspaceGroups,
  children,
}: {
  workspaceSlug: string;
  workspaceGroups: ShellWorkspaceGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [rawPoll, setPoll] = useState<ShellPoll | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Preferences live in localStorage; the server render uses the defaults.
  const collapsed = useStored(storageKeys.collapsed, (v) => v === true, false);
  const closedGroups = useStored(storageKeys.groups, asStrings, NONE);
  const pins = useStored(storageKeys.pins(workspaceSlug), (v) => asStrings(v, 12), NONE);

  const toggleCollapsed = useCallback(() => {
    writeJson(storageKeys.collapsed, readJson<unknown>(storageKeys.collapsed, false) !== true);
  }, []);
  const toggleGroup = useCallback((id: string) => {
    const g = asStrings(readJson<unknown>(storageKeys.groups, []));
    writeJson(storageKeys.groups, g.includes(id) ? g.filter((x) => x !== id) : [...g, id]);
  }, []);
  const togglePin = useCallback(
    (segment: string) => {
      const key = storageKeys.pins(workspaceSlug);
      const p = asStrings(readJson<unknown>(key, []), 12);
      writeJson(key, p.includes(segment) ? p.filter((x) => x !== segment) : [...p, segment].slice(-12));
    },
    [workspaceSlug],
  );

  const onOrders = pathname === `/${workspaceSlug}/orders` || pathname.startsWith(`/${workspaceSlug}/orders/`);
  const inFlight = useRef(false);
  const refreshPoll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const since = readJson<unknown>(storageKeys.ordersSeen(workspaceSlug), null);
      setPoll(await pollShell(workspaceSlug, typeof since === "string" ? since : null));
    } catch {
      // Offline or the session ended: keep the last counts.
    } finally {
      inFlight.current = false;
    }
  }, [workspaceSlug]);

  // Visiting Orders resets the "new orders" badge (the next poll counts from now).
  useEffect(() => {
    if (onOrders) writeJson(storageKeys.ordersSeen(workspaceSlug), new Date().toISOString());
  }, [onOrders, workspaceSlug]);
  const poll = useMemo(() => (rawPoll && onOrders ? { ...rawPoll, orders: 0 } : rawPoll), [rawPoll, onOrders]);

  useEffect(() => {
    const first = window.setTimeout(() => void refreshPoll(), 0);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshPoll();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refreshPoll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshPoll]);

  const markRead = useCallback(
    (ids?: string[]) => {
      setPoll((p) => {
        if (!p) return p;
        const hit = (id: string) => !ids || ids.includes(id);
        const newlyRead = p.notifications.filter((n) => !n.read && hit(n.id)).length;
        return {
          ...p,
          unread: ids ? Math.max(0, p.unread - newlyRead) : 0,
          notifications: p.notifications.map((n) => (hit(n.id) ? { ...n, read: true } : n)),
        };
      });
      void markNotificationsRead(workspaceSlug, ids).catch(() => {});
    },
    [workspaceSlug],
  );

  const value = useMemo<ShellState>(
    () => ({
      workspaceSlug,
      workspaceGroups,
      collapsed,
      toggleCollapsed,
      closedGroups,
      toggleGroup,
      pins,
      togglePin,
      poll,
      refreshPoll: () => void refreshPoll(),
      markRead,
      paletteOpen,
      setPaletteOpen,
      helpOpen,
      setHelpOpen,
      createOpen,
      setCreateOpen,
    }),
    [
      workspaceSlug,
      workspaceGroups,
      collapsed,
      toggleCollapsed,
      closedGroups,
      toggleGroup,
      pins,
      togglePin,
      poll,
      refreshPoll,
      markRead,
      paletteOpen,
      helpOpen,
      createOpen,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
