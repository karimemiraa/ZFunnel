import { Card, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { cn } from "@zfunnel/ui/lib/utils";
import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { ROOT_DOMAIN } from "@/lib/env";
import { NAV_MODULES } from "@/lib/nav";

export const metadata = { title: "Overview" };

export default async function OverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { user, workspace } = await requireWorkspace(params);
  const steps = [
    { done: true, label: "Create your workspace" },
    { done: false, label: "Connect Stripe to accept payments", phase: 1 },
    { done: false, label: "Build your first funnel from a template", phase: 1 },
    { done: false, label: "Connect your own domain", phase: 1 },
  ];
  const siteUrl = `${workspace.slug}.${ROOT_DOMAIN}`;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={`Here's what's happening in ${workspace.name}.`}
        actions={
          <a
            href={`${ROOT_DOMAIN.startsWith("localhost") ? "http" : "https"}://${siteUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {siteUrl} <ExternalLinkIcon className="size-3.5" />
          </a>
        }
      />
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>Finish these steps to launch your first funnel.</CardDescription>
          <ol className="mt-4 space-y-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                {s.done ? (
                  <CheckCircle2Icon className="size-5 text-emerald-500" />
                ) : (
                  <CircleIcon className="size-5 text-muted-foreground" />
                )}
                <span className={cn(s.done && "text-muted-foreground line-through")}>{s.label}</span>
                {s.phase && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                    Soon
                  </span>
                )}
              </li>
            ))}
          </ol>
        </CardHeader>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_MODULES.filter((m) => m.segment).map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.segment} href={`/${workspace.slug}/${m.segment}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{m.label}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
