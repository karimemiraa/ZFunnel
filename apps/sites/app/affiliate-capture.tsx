"use client";

import { useEffect } from "react";

/** On any page: remembers ?aff=code (last click wins) and counts the click once per page load. */
export function AffiliateCapture() {
  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get("aff")?.toLowerCase();
    if (!aff || !/^[a-z0-9-]{3,32}$/.test(aff)) return;
    document.cookie = `zf_aff=${aff}.${Date.now()}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const key = `zf_aff_click_${aff}`;
    // One click per browser session per code.
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void fetch("/api/aff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: aff }),
      keepalive: true,
    });
  }, []);
  return null;
}
