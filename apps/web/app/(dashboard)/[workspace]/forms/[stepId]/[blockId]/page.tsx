import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireWorkspace } from "@/lib/context";
import { getFormResponses, summarize } from "@/lib/forms";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("formsAdmin.responsesTitle") };
}

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
  const [t, f] = await Promise.all([getT(), getFmt()]);
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
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> {t("formsAdmin.pageTitle")}
      </Link>
      <PageHeader
        title={name}
        description={t("formsAdmin.responsesCount", { count: rows.length })}
        actions={
          <Button variant="outline" asChild>
            <a href={`${base}/export`}>
              <DownloadIcon /> {t("formsAdmin.exportCsv")}
            </a>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("formsAdmin.colResponses")} value={f.number(rows.length)} />
        <StatCard label={t("formsAdmin.withEmail")} value={f.number(rows.filter((r) => r.s.contactId).length)} />
        <StatCard
          label={scored.length ? t("formsAdmin.averageScore") : t("formsAdmin.latest")}
          value={
            scored.length
              ? (scored.reduce((s, r) => s + (r.s.score ?? 0), 0) / scored.length).toFixed(1)
              : f.timeAgo(rows[0]!.s.createdAt)
          }
        />
      </div>
      <nav className="mb-5 inline-flex rounded-lg bg-muted p-0.5" aria-label={t("formsAdmin.view")}>
        {(["summary", "responses"] as const).map((v) => (
          <Link
            key={v}
            href={v === "summary" ? base : `${base}?view=responses`}
            className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${tab === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t(`formsAdmin.tab.${v}`)}
          </Link>
        ))}
      </nav>

      {tab === "summary" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {outcomes.size > 0 && (
            <Bars
              title={t("formsAdmin.quizResults")}
              total={rows.length}
              answersLabel={t("formsAdmin.answersCount", { count: rows.length })}
              items={[...outcomes.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n)}
            />
          )}
          {summary.map((q) =>
            q.choices ? (
              <Bars
                key={q.key}
                title={q.label}
                total={q.answered}
                answersLabel={t("formsAdmin.answersCount", { count: q.answered })}
                items={q.choices}
              />
            ) : (
              <section key={q.key} className="rounded-xl border bg-card p-5">
                <h2 className="font-semibold">{q.label}</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("formsAdmin.answersLatest", { count: q.answered })}
                </p>
                <ul className="grid gap-2">
                  {q.samples.map((sample, i) => (
                    <li key={i} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      {sample}
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
                <th className="px-4 py-3">{t("formsAdmin.colContact")}</th>
                {summary.map((q) => (
                  <th key={q.key} className="max-w-56 px-4 py-3">
                    {q.label}
                  </th>
                ))}
                {scored.length > 0 && <th className="px-4 py-3">{t("formsAdmin.colResult")}</th>}
                <th className="px-4 py-3 text-end">{t("formsAdmin.colWhen")}</th>
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
                      <span className="text-muted-foreground">{t("formsAdmin.anonymous")}</span>
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
                  <td className="px-4 py-3 text-end whitespace-nowrap text-muted-foreground">
                    {f.timeAgo(s.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Bars({
  title,
  total,
  answersLabel,
  items,
}: {
  title: string;
  total: number;
  answersLabel: string;
  items: { value: string; n: number }[];
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{answersLabel}</p>
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
