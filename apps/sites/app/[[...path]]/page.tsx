import { Render } from "@puckeditor/core/rsc";
import { config, type BlockRuntime } from "@zfunnel/blocks";
import { getPaymentSetup, getStepOffers, system, toRuntimeOffers } from "@zfunnel/payments";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePage } from "@/lib/resolve";
import { Tracker } from "../tracker";
import { currentHostSuspended, currentWorkspace } from "@/lib/site";
import { Unavailable } from "../unavailable";
import { pickVariant, variantCookie } from "@/lib/variants";
import { visitorLocale } from "@/lib/locale";
import { getT } from "@/lib/i18n";

type Params = { params: Promise<{ path?: string[] }> };

async function load({ params }: Params) {
  const ws = await currentWorkspace();
  if (!ws) return null;
  const { path = [] } = await params;
  return { ws, page: await resolvePage(ws, path) };
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const r = await load(props);
  if (!r && (await currentHostSuspended()))
    return { title: (await getT())("site.unavailable"), robots: { index: false } };
  if (!r?.page) return { title: r?.ws?.name ?? "Not found" };
  const root = (r.page.data.root?.props ?? {}) as { title?: string; seoDescription?: string; ogImage?: string };
  const title = root.title || r.page.step.name;
  return {
    title,
    // The workspace logo doubles as the favicon (checked by the funnel health check).
    icons: r.ws.logoUrl ? { icon: r.ws.logoUrl } : undefined,
    description: root.seoDescription || undefined,
    openGraph: {
      title,
      description: root.seoDescription || undefined,
      images: root.ogImage ? [root.ogImage] : undefined,
    },
  };
}

export default async function SitePage(props: Params) {
  const r = await load(props);
  if (!r && (await currentHostSuspended())) return <Unavailable />;
  if (!r) notFound();
  if (!r.page) {
    // Root of a workspace without a homepage yet: a friendly placeholder instead of a bare 404.
    if ((await props.params).path === undefined)
      return (
        <main className="flex min-h-dvh items-center justify-center p-6 text-center text-zinc-900">
          <div>
            <h1 className="text-3xl font-bold">{r.ws.name}</h1>
            <p className="mt-2 text-zinc-500">{(await getT())("site.nothingYet")}</p>
          </div>
        </main>
      );
    notFound();
  }

  const selling = ["checkout", "upsell", "downsell", "sales", "page"].includes(r.page.step.type);
  const commerce = selling
    ? await system(async (tx) => {
        const [offers, setup] = await Promise.all([getStepOffers(tx, r.page!.step.id), getPaymentSetup(tx, r.ws.id)]);
        return { offers: toRuntimeOffers(offers), setup };
      })
    : null;

  const runtime: BlockRuntime = {
    mode: "live",
    locale: await visitorLocale(),
    lang: r.ws.siteLocale,
    offers: commerce?.offers,
    payments: commerce?.setup
      ? commerce.setup.provider === "stripe"
        ? { provider: "stripe", publishableKey: commerce.setup.publishableKey, accountId: commerce.setup.accountId }
        : { provider: "test" }
      : null,
    nextUrl: r.page.nextPath ?? undefined,
    declineUrl: r.page.declinePath ?? undefined,
    stepId: r.page.step.id,
    apiBase: "/api",
  };
  // Split test: show this visitor's variant (sticky via a cookie the tracker sets).
  const cookieName = variantCookie(r.page.step.id);
  const pick = pickVariant(r.page.variants, (await cookies()).get(cookieName)?.value);
  const data = (pick.id && r.page.variants.find((v) => v.id === pick.id)?.data) || r.page.data;
  const split = r.page.variants.length ? { cookie: cookieName, value: pick.id ?? "a" } : undefined;
  return (
    <>
      <Render config={config} data={data as never} metadata={runtime} />
      <Tracker stepId={r.page.step.id} split={split} />
    </>
  );
}
