import { describePrice } from "@zfunnel/blocks";
import { intlLocale } from "@zfunnel/i18n";
import { getT } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentWorkspace } from "@/lib/site";
import { storeProducts } from "@/lib/store";
import { Brand } from "@/app/brand";

export async function generateMetadata(): Promise<Metadata> {
  const ws = await currentWorkspace();
  const t = await getT();
  return { title: ws ? t("store.metaTitle", { name: ws.name }) : t("store.shop") };
}

export default async function StorePage() {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const list = await storeProducts(ws.id);
  const t = await getT();
  const loc = ws.siteLocale === "ar" ? intlLocale("ar") : undefined;
  return (
    <main className="min-h-dvh bg-white text-zinc-900">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/store">
            <Brand ws={ws} />
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight">{t("store.shop")}</h1>
        {list.length === 0 && <p className="mt-6 text-zinc-500">{t("store.empty")}</p>}
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ p, price }) => (
            <Link key={p.id} href={`/store/${p.id}`} className="group">
              <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <h2 className="font-semibold group-hover:underline">{p.name}</h2>
                <span className="shrink-0 font-semibold">{describePrice(price, t, loc)}</span>
              </div>
              {p.stock === 0 && <p className="mt-1 text-sm font-medium text-red-600">{t("store.soldOut")}</p>}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
