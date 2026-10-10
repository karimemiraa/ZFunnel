import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireWorkspace } from "@/lib/context";
import { timeAgo } from "@/lib/format";
import { getFormResponses, summarize } from "@/lib/forms";

export const metadata = { title: "Form responses" };

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; stepId: string; blockId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { stepId, blockId: rawBlock } = await params;
  const { view } = await searchParams;
  const blockId = decodeURIComponent(rawBlock);
  const rows = await getFormResponses(ctx, stepId, blockId);
  if (!rows.length) notFound();
  const ws = ctx.workspace.slug;
  const name = rows[0]!.s.formName;
  const summary = summarize(rows);
  const scored = rows.filter((r) => r.s.score !== null);
  const outcomes = new Map<string, number>();
  for (const r of rows) if (r.s.outcome) outcomes.set(r.s.outcome, (outcomes.get(r.s.outcome) ?? 0) + 1);
  const base = `/${ws}/forms/${stepId}/${encodeURIComponent(blockId)}`;
  const tab = view === "responses" ? "responses" : "summary";

  return (
    <>
      <Link
        href={`/${ws}/forms`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> Forms
      </Link>
      <PageHeader
        title={name}
        description={`${rows.length.toLocaleString()} ${rows.length === 1 ? "response" : "responses"}`}
        actions={
          <Button variant="outline" asChild>
            <a href={`${base}/export`}>
              <DownloadIcon /> Export CSV
            </a>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Responses" value={rows.length.toLocaleString()} />
        <StatCard label="With email" value={rows.filter((r) => r.s.contactId).length.toLocaleString()} />
        <StatCard
          label={scored.length ? "Average score" : "Latest"}
          value={
            scored.length
              ? (scored.reduce((s, r) => s + (r.s.score ?? 0), 0) / scored.length).toFixed(1)
              : timeAgo(rows[0]!.s.createdAt)
          }
        />
      </div>
      <nav className="mb-5 inline-flex rounded-lg bg-muted p-0.5" aria-label="View">
        {(["summary", "responses"] as const).map((t) => (
          <Link
            key={t}
            href={t === "summary" ? base : `${base}?view=responses`}
            className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </Link>
        ))}
      </nav>

      {tab === "summary" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {outcomes.size > 0 && (
            <Bars
              title="Quiz results"
              total={rows.length}
              items={[...outcomes.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n)}
            />
          )}
          {summary.map((q) =>
            q.choices ? (
              <Bars key={q.key} title={q.label} total={q.answered} items={q.choices} />
            ) : (
              <section key={q.key} className="rounded-xl border bg-card p-5">
                <h2 className="font-semibold">{q.label}</h2>
                <p className="mb-3 text-xs text-muted-foreground">{q.answered.toLocaleString()} answers · latest</p>
                <ul className="grid gap-2">
                  {q.samples.map((t, i) => (
                    <li key={i} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Contact</th>
                {summary.map((q) => (
                  <th key={q.key} className="max-w-56 px-4 py-3">
                    {q.label}
                  </th>
                ))}
                {scored.length > 0 && <th className="px-4 py-3">Result</th>}
                <th className="px-4 py-3 text-end">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 500).map(({ s, email, name: cname }) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.contactId ? (
                      <Link href={`/${ws}/contacts/${s.contactId}`} className="font-medium hover:underline">
                        {cname || email}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Anonymous</span>
                    )}
                  </td>
                  {summary.map((q) => {
                    const a = s.answers.find((x) => x.key === q.key);
                    return (
                      <td key={q.key} className="max-w-56 truncate px-4 py-3" title={a ? String(a.value) : ""}>
                        {a ? (
                          Array.isArray(a.value) ? (
                            a.value.join(", ")
                          ) : (
                            a.value
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  {scored.length > 0 && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.outcome ?? "—"} <span className="text-xs text-muted-foreground">({s.score})</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-end whitespace-nowrap text-muted-foreground">{timeAgo(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Bars({ title, total, items }: { title: string; total: number; items: { value: string; n: number }[] }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {total.toLocaleString()} {total === 1 ? "answer" : "answers"}
      </p>
      <ul className="grid gap-3">
        {items.slice(0, 12).map((c) => {
          const pct = total ? Math.round((c.n / total) * 100) : 0;
          return (
            <li key={c.value} title={`${c.value}: ${c.n} (${pct}%)`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{c.value}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {pct}% · {c.n.toLocaleString()}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
