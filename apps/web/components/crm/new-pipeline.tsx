"use client";

import { Button } from "@zfunnel/ui/button";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createPipeline } from "@/lib/crm-actions";

export function NewPipelineButton({ workspaceSlug, size }: { workspaceSlug: string; size?: "lg" }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      size={size}
      variant={size ? "default" : "outline"}
      disabled={busy}
      onClick={() => {
        const name = prompt("Pipeline name", "Sales pipeline");
        if (!name) return;
        start(async () => {
          const r = await createPipeline(workspaceSlug, name);
          if (!r.ok) return void toast.error(r.error);
          router.push(`/${workspaceSlug}/pipelines?p=${r.id}`);
          router.refresh();
        });
      }}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} New pipeline
    </Button>
  );
}
