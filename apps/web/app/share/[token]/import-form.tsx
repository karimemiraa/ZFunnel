"use client";

import { Button } from "@zfunnel/ui/button";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { importSharedFunnel } from "@/lib/funnel-actions";

export function ImportForm({ token, workspaces }: { token: string; workspaces: { slug: string; name: string }[] }) {
  const [ws, setWs] = useState(workspaces[0]?.slug ?? "");
  const [pending, start] = useTransition();
  if (!workspaces.length)
    return <p className="text-sm text-muted-foreground">Create a workspace first, then come back to this link.</p>;
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Import into
        <NativeSelect value={ws} onChange={(e) => setWs(e.target.value)}>
          {workspaces.map((w) => (
            <option key={w.slug} value={w.slug}>
              {w.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await importSharedFunnel(token, ws);
            if (r && !r.ok) toast.error(r.error);
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} Import funnel
      </Button>
    </div>
  );
}
