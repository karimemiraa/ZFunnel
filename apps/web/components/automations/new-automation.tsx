"use client";

import type { MessageKey } from "@zfunnel/i18n";
import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { CreditCardIcon, Loader2Icon, MailOpenIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWorkflow, type Recipe } from "@/lib/automation-actions";

const RECIPES: {
  id: Recipe;
  title: MessageKey;
  desc: MessageKey;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  /** Pre-filled automation name (an i18n key), or null for none. */
  name: MessageKey | null;
  trigger: object;
}[] = [
  {
    id: "welcome",
    title: "automations.create.welcomeTitle",
    desc: "automations.create.welcomeDesc",
    icon: MailOpenIcon,
    color: "#6366f1",
    name: "automations.create.welcomeTitle",
    trigger: { type: "optin" },
  },
  {
    id: "customer",
    title: "automations.create.customerTitle",
    desc: "automations.create.customerDesc",
    icon: CreditCardIcon,
    color: "#10b981",
    name: "automations.create.customerTitle",
    trigger: { type: "purchase" },
  },
  {
    id: "blank",
    title: "automations.create.blankTitle",
    desc: "automations.create.blankDesc",
    icon: SparklesIcon,
    color: "#7c3aed",
    name: null,
    trigger: { type: "optin" },
  },
];

export function NewAutomation({ workspaceSlug, trigger }: { workspaceSlug: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [recipe, setRecipe] = useState<Recipe>("welcome");
  const [name, setName] = useState(() => t("automations.create.welcomeTitle"));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("automations.create.title")}</DialogTitle>
          <DialogDescription>{t("automations.create.description")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            const r = RECIPES.find((x) => x.id === recipe)!;
            start(async () => {
              const res = await createWorkflow(workspaceSlug, { name, trigger: r.trigger, recipe });
              if (!res.ok) return setError(res.error);
              router.push(`/automation/${workspaceSlug}/${res.id}`);
            });
          }}
        >
          <div className="grid gap-2" role="radiogroup" aria-label={t("automations.create.recipe")}>
            {RECIPES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={recipe === r.id}
                onClick={() => {
                  setRecipe(r.id);
                  setName(r.name ? t(r.name) : "");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                  recipe === r.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: r.color }}
                >
                  <r.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t(r.title)}</span>
                  <span className="block text-xs text-muted-foreground">{t(r.desc)}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="automation-name">{t("automations.create.name")}</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("automations.create.namePlaceholder")}
              required
              maxLength={80}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} {t("automations.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
