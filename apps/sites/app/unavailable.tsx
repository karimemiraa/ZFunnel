import { getT } from "@/lib/i18n";

/** Neutral page for a site whose organization is suspended. Says nothing about why. */
export async function Unavailable() {
  const t = await getT();
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center text-zinc-900">
      <div>
        <h1 className="text-2xl font-bold">{t("site.unavailable")}</h1>
        <p className="mt-2 text-zinc-500">{t("site.unavailableText")}</p>
      </div>
    </main>
  );
}
