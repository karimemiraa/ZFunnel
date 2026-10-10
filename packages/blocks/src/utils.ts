import { clsx, type ClassValue } from "clsx";
import type { Align, HideOn } from "./fields";

export const cx = (...v: ClassValue[]) => clsx(v);

export const alignText: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" };
export const alignItems: Record<Align, string> = { left: "items-start", center: "items-center", right: "items-end" };
export const justify: Record<Align, string> = { left: "justify-start", center: "justify-center", right: "justify-end" };

export function hideClass(hideOn: HideOn | undefined) {
  if (hideOn === "mobile") return "max-md:hidden";
  if (hideOn === "desktop") return "md:hidden";
  return "";
}

/** Converts YouTube / Vimeo / direct links into an embeddable URL. */
export function toEmbed(url: string): { kind: "iframe" | "video"; src: string } | null {
  const u = url.trim();
  if (!u) return null;
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1` };
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1` };
  if (/^https?:\/\/.+\.(mp4|webm|mov)(\?.*)?$/i.test(u)) return { kind: "video", src: u };
  if (/^https:\/\//i.test(u)) return { kind: "iframe", src: u };
  return null;
}
