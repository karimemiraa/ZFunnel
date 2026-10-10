"use client";

import { useEffect } from "react";

/**
 * Keeps ad click ids from the landing URL so server-side conversions can be matched later:
 * ?fbclid → _fbc (Meta's documented format), ?ttclid → zf_ttclid.
 */
export function ClickCapture() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const set = (name: string, value: string, days: number) =>
      (document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${days * 86_400}; samesite=lax`);
    const fbclid = q.get("fbclid");
    if (fbclid && /^[\w.-]{10,500}$/.test(fbclid)) set("_fbc", `fb.1.${Date.now()}.${fbclid}`, 90);
    const ttclid = q.get("ttclid");
    if (ttclid && /^[\w.-]{10,500}$/.test(ttclid)) set("zf_ttclid", ttclid, 30);
  }, []);
  return null;
}
