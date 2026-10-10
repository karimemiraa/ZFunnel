import { Render } from "@puckeditor/core/rsc";
import { block, config, describePrice, page, type BlockRuntime } from "@zfunnel/blocks";
import { getPaymentSetup, system, toRuntimeOffers } from "@zfunnel/payments";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentWorkspace } from "@/lib/site";
import { storeProduct } from "@/lib/store";

type P = { params: Promise<{ productId: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const ws = await currentWorkspace();
  const r = ws ? await storeProduct(ws.id, (await params).productId) : null;
  return r
    ? {
        title: `${r.p.name} · ${ws!.name}`,
        description: r.p.description ?? undefined,
        openGraph: { images: r.p.imageUrl ? [r.p.imageUrl] : undefined },
      }
    : { title: "Not found" };
}

export default async function ProductPage({ params }: P) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const r = await storeProduct(ws.id, (await params).productId);
  if (!r) notFound();
  const setup = await system((tx) => getPaymentSetup(tx, ws.id));
  const runtime: BlockRuntime = {
    mode: "live",
    apiBase: "/api",
    offers: r.offer ? toRuntimeOffers([r.offer]) : [],
    payments: setup
      ? setup.provider === "stripe"
        ? { provider: "stripe", publishableKey: setup.publishableKey, accountId: setup.accountId }
        : { provider: "test" }
      : null,
    store: { priceId: r.price.id, shipping: r.p.requiresShipping },
  };
  const checkout = page("Checkout", [block("OrderForm", { buttonLabel: "Buy now" } as never)], {});
  return (
    <main className="min-h-dvh bg-white text-zinc-900">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/store" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            ← {ws.name} shop
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-50">
          {r.p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.p.imageUrl} alt={r.p.name} className="size-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{r.p.name}</h1>
          <p className="mt-3 text-2xl font-semibold">{describePrice(r.price)}</p>
          {r.p.description && <p className="mt-4 leading-7 whitespace-pre-line text-zinc-600">{r.p.description}</p>}
          {r.p.stock !== null && r.p.stock > 0 && r.p.stock <= 10 && (
            <p className="mt-3 text-sm font-medium text-amber-600">Only {r.p.stock} left</p>
          )}
          <div className="mt-8">
            {r.soldOut ? (
              <p className="rounded-2xl bg-zinc-100 p-6 text-center font-semibold text-zinc-600">Sold out</p>
            ) : (
              <Render config={config} data={checkout as never} metadata={runtime} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
