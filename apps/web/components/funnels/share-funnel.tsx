"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { toast } from "@zfunnel/ui/toaster";
import { CopyIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFunnelSharing } from "@/lib/funnel-actions";

export function ShareFunnel({
  workspaceSlug,
  funnelId,
  token: initial,
}: {
  workspaceSlug: string;
  funnelId: string;
  token: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initial);
  const [pending, start] = useTransition();
  const link = token ? `${typeof window === "undefined" ? "" : window.location.origin}/share/${token}` : "";
  const toggle = (on: boolean) =>
    start(async () => {
      const r = await setFunnelSharing(workspaceSlug, funnelId, on);
      if (!r.ok) return void toast.error(r.error);
      setToken(r.token ?? null);
      router.refresh();
    });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2Icon /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this funnel</DialogTitle>
          <DialogDescription>
            Anyone with the link can preview it and import a copy into their own ZFunnel account. Your products,
            contacts and settings are never shared.
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Link copied");
                }}
              >
                <CopyIcon /> Copy
              </Button>
            </div>
            <Button
              variant="ghost"
              className="justify-self-start text-muted-foreground"
              disabled={pending}
              onClick={() => toggle(false)}
            >
              {pending && <Loader2Icon className="animate-spin" />} Stop sharing (the link stops working)
            </Button>
          </div>
        ) : (
          <Button disabled={pending} onClick={() => toggle(true)}>
            {pending && <Loader2Icon className="animate-spin" />} Create share link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
