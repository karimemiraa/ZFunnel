import "server-only";

import { and, asc, desc, eq, isNull, prices, products } from "@zfunnel/db";
import { getStoreOffer, system } from "@zfunnel/payments";

export async function storeProducts(workspaceId: string) {
  return system(async (tx) => {
    const list = await tx
      .select()
      .from(products)
      .where(and(eq(products.workspaceId, workspaceId), eq(products.inStore, true), isNull(products.archivedAt)))
      .orderBy(asc(products.name));
    const out = [];
    for (const p of list) {
      const [price] = await tx
        .select()
        .from(prices)
        .where(and(eq(prices.productId, p.id), isNull(prices.archivedAt)))
        .orderBy(desc(prices.createdAt))
        .limit(1);
      if (price) out.push({ p, price });
    }
    return out;
  });
}

export async function storeProduct(workspaceId: string, productId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return null;
  return system(async (tx) => {
    const [p] = await tx
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.workspaceId, workspaceId),
          eq(products.inStore, true),
          isNull(products.archivedAt),
        ),
      );
    if (!p) return null;
    const [price] = await tx
      .select()
      .from(prices)
      .where(and(eq(prices.productId, p.id), isNull(prices.archivedAt)))
      .orderBy(desc(prices.createdAt))
      .limit(1);
    if (!price) return null;
    const offer = await getStoreOffer(tx, workspaceId, price.id);
    return { p, price, offer, soldOut: !offer };
  });
}
