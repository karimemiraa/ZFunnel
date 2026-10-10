"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAffiliatePaid, saveAffiliateSettings, setAffiliateStatus } from "@/lib/affiliate-actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
        if (r.message) toast.success(r.message);
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  return { pending, run };
}

export function ProgramSettings({
  workspaceSlug,
  initial,
  portalUrl,
}: {
  workspaceSlug: string;
  initial: { enabled: boolean; commissionPercent: number; cookieDays: number; terms: string };
  portalUrl: string;
}) {
  const [v, setV] = useState(initial);
  const { pending, run } = useRun();
  return (
    <form
      className="grid gap-4 rounded-xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveAffiliateSettings(workspaceSlug, v));
      }}
    >
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-4"
          checked={v.enabled}
          onChange={(e) => setV({ ...v, enabled: e.target.checked })}
        />
        <span className="font-semibold">Affiliate program is open</span>
      </label>
      <p className="-mt-2 text-sm text-muted-foreground">
        Partners join at{" "}
        <a href={portalUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {portalUrl.replace(/^https?:\/\//, "")}
        </a>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="aff-pct">Commission (%)</Label>
          <Input
            id="aff-pct"
            type="number"
            min={1}
            max={90}
            value={v.commissionPercent}
            onChange={(e) => setV({ ...v, commissionPercent: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="aff-days">Cookie (days)</Label>
          <Input
            id="aff-days"
            type="number"
            min={1}
            max={365}
            value={v.cookieDays}
            onChange={(e) => setV({ ...v, cookieDays: Number(e.target.value) || 1 })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="aff-terms">Terms (shown on the sign-up page)</Label>
        <Textarea
          id="aff-terms"
          rows={3}
          value={v.terms}
          onChange={(e) => setV({ ...v, terms: e.target.value })}
          placeholder="E.g. Commissions are paid monthly via PayPal once they pass the 30-day refund window."
        />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} Save
        </Button>
      </div>
    </form>
  );
}

export function AffiliateRowActions({
  workspaceSlug,
  id,
  owed,
  status,
}: {
  workspaceSlug: string;
  id: string;
  owed: number;
  status: "active" | "disabled";
}) {
  const { pending, run } = useRun();
  return (
    <div className="flex justify-end gap-1">
      {owed > 0 && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            confirm("Mark all pending commissions of this affiliate as paid?") &&
            run(() => markAffiliatePaid(workspaceSlug, id))
          }
        >
          Mark paid
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => setAffiliateStatus(workspaceSlug, id, status === "active" ? "disabled" : "active"))}
      >
        {status === "active" ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}
