"use client";

import { useEffect } from "react";

/**
 * Sends one page-view beacon per page load. No third parties. The only cookie is the
 * split-test assignment, set only while a test runs so a visitor keeps seeing the same version.
 */
export function Tracker({ stepId, split }: { stepId: string; split?: { cookie: string; value: string } }) {
  useEffect(() => {
    if (split) document.cookie = `${split.cookie}=${split.value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    const q = new URLSearchParams(window.location.search);
    const w = window.innerWidth;
    const body = JSON.stringify({
      stepId,
      variantId: split?.value,
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
  }, [stepId, split?.cookie, split?.value]);
  return null;
}
