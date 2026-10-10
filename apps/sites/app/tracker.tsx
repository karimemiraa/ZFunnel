"use client";

import { useEffect } from "react";

/** Sends one page-view beacon per page load. No cookies, no third parties. */
export function Tracker({ stepId }: { stepId: string }) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const w = window.innerWidth;
    const body = JSON.stringify({
      stepId,
      utmSource: q.get("utm_source") ?? undefined,
      utmMedium: q.get("utm_medium") ?? undefined,
      utmCampaign: q.get("utm_campaign") ?? undefined,
      referrer:
        document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : undefined,
      device: w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop",
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/t", blob))
      void fetch("/api/t", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  }, [stepId]);
  return null;
}
