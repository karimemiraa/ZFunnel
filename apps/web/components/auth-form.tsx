"use client";

import { authClient } from "@zfunnel/auth/client";
import type { MessageKey } from "@zfunnel/i18n";
import { Button } from "@zfunnel/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { useLocale, useT } from "@zfunnel/i18n/react";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const AUTH_ERRORS: Record<string, MessageKey> = {
  INVALID_EMAIL_OR_PASSWORD: "auth.invalidCredentials",
  USER_ALREADY_EXISTS: "auth.userExists",
  PASSWORD_TOO_SHORT: "auth.passwordTooShort",
  INVALID_EMAIL: "common.invalidEmail",
};

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isSignUp = mode === "sign-up";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setError(null);
    startTransition(async () => {
      const { error } = isSignUp
        ? await authClient.signUp.email({ name: String(form.get("name")), email, password })
        : await authClient.signIn.email({ email, password });
      if (error) {
        const known = error.code ? AUTH_ERRORS[error.code] : undefined;
        // Better Auth messages are English; show ours in Arabic for the errors we know.
        setError(locale !== "en" && known ? t(known) : (error.message ?? t("common.somethingWrong")));
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{isSignUp ? t("auth.createYourAccount") : t("auth.welcomeBack")}</CardTitle>
        <CardDescription>{isSignUp ? t("auth.signUpSubtitle") : t("auth.signInSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.fullName")}</Label>
              <Input id="name" name="name" autoComplete="name" required minLength={2} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={isSignUp ? 10 : undefined}
            />
            {isSignUp && <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>}
          </div>
          <FormMessage message={error} />
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            {isSignUp ? t("auth.createAccount") : t("auth.signIn")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? t("auth.haveAccount") : t("auth.newHere")}
            <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-medium text-primary hover:underline">
              {isSignUp ? t("auth.signIn") : t("auth.createAnAccount")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
