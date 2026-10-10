import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center text-zinc-900">
      <div>
        <p className="text-sm font-semibold tracking-widest text-zinc-400 uppercase">404</p>
        <h1 className="mt-2 text-2xl font-bold">{t("site.notFound")}</h1>
        <p className="mt-2 text-zinc-500">{t("site.notFoundText")}</p>
      </div>
    </main>
  );
}
