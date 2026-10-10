import { and, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { contacts } from "./schema/contacts";
import type { SegmentRule } from "./schema/crm";

const DAY = 86_400_000;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** SQL condition for one rule over the contacts table. Values are always bound parameters. */
export function ruleCondition(rule: SegmentRule): SQL {
  switch (rule.field) {
    case "tag":
      return rule.op === "has"
        ? sql`${rule.value} = any(${contacts.tags})`
        : sql`not (${rule.value} = any(${contacts.tags}))`;
    case "email":
      return ilike(contacts.email, `%${escapeLike(rule.value)}%`);
    case "name":
      return ilike(sql`coalesce(${contacts.name}, '')`, `%${escapeLike(rule.value)}%`);
    case "created": {
      const cutoff = new Date(Date.now() - rule.value * DAY);
      return rule.op === "within_days" ? gte(contacts.createdAt, cutoff) : lt(contacts.createdAt, cutoff);
    }
    case "customer": {
      const isCustomer = sql`exists (select 1 from orders o where o.contact_id = ${contacts.id} and o.status in ('paid','partially_refunded'))`;
      return rule.op === "is" ? isCustomer : sql`not ${isCustomer}`;
    }
    case "source_funnel":
      return sql`${contacts.sourceFunnelId} = ${rule.value}::uuid`;
    case "custom": {
      const v = sql`(${contacts.fields} ->> ${rule.key})`;
      if (rule.op === "is_set") return sql`coalesce(${v}, '') <> ''`;
      if (rule.op === "equals") return sql`${v} = ${rule.value ?? ""}`;
      return sql`${v} ilike ${`%${escapeLike(rule.value ?? "")}%`}`;
    }
  }
}

/** WHERE clause for a whole segment; an empty rule list matches everyone. */
export function segmentCondition(match: "all" | "any", rules: SegmentRule[]): SQL | undefined {
  if (!rules.length) return undefined;
  const parts = rules.map(ruleCondition);
  return match === "any" ? or(...parts) : and(...parts);
}
