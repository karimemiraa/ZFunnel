import { conversionDeliveries, desc, trackingSettings } from "@zfunnel/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { cn } from "@zfunnel/ui/lib/utils";
import { TrackingSettings } from "@/components/tracking-settings";
import { requireWorkspace } from "@/lib/context";
import { timeAgo } from "@/lib/format";
import { inWorkspace } from "@/lib/funnels";

export const metadata = { title: "Tracking" };

const PLATFORM: Record<string, string> = { meta: "Meta", tiktok: "TikTok", ga4: "GA4" };

export default async function TrackingPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const { s, log } = await inWorkspace(ctx, async (tx) => {
    const [s] = await tx.select().from(trackingSettings);
    const log = await tx
      .select({
        id: conversionDeliveries.id,
        platform: conversionDeliveries.platform,
        event: conversionDeliveries.event,
        eventId: conversionDeliveries.eventId,
        status: conversionDeliveries.status,
        error: conversionDeliveries.error,
        createdAt: conversionDeliveries.createdAt,
      })
      .from(conversionDeliveries)
      .orderBy(desc(conversionDeliveries.createdAt))
      .limit(25);
    return { s, log };
  });
  return (
    <div className="space-y-6">
      <TrackingSettings
        workspaceSlug={ctx.workspace.slug}
        current={{
          meta: {
            id: s?.metaPixelId ?? null,
            hasToken: Boolean(s?.metaTokenSealed),
            testCode: s?.metaTestCode ?? null,
          },
          tiktok: {
            id: s?.tiktokPixelCode ?? null,
            hasToken: Boolean(s?.tiktokTokenSealed),
            testCode: s?.tiktokTestCode ?? null,
          },
          ga4: { id: s?.ga4MeasurementId ?? null, hasToken: Boolean(s?.ga4SecretSealed), testCode: null },
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Recent server events</CardTitle>
          <CardDescription>
            Opt-ins and purchases sent to your ad platforms. Emails and phone numbers are hashed (SHA-256) before they
            leave ZFunnel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-start text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-2">Platform</th>
                  <th className="py-2">Event</th>
                  <th className="py-2 max-sm:hidden">Event ID</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-end">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {log.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 font-medium">{PLATFORM[d.platform]}</td>
                    <td className="py-2">{d.event}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground max-sm:hidden">{d.eventId}</td>
                    <td className="py-2">
                      <span
                        title={d.error ?? undefined}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          d.status === "sent" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          d.status === "pending" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                          d.status === "failed" && "bg-red-500/10 text-red-700 dark:text-red-400",
                        )}
                      >
                        {d.status === "sent" ? "Sent" : d.status === "pending" ? "Retrying" : "Failed"}
                      </span>
                    </td>
                    <td className="py-2 text-end text-muted-foreground">{timeAgo(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
