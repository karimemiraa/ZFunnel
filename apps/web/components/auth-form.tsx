"use client";

import { authClient } from "@zfunnel/auth/client";
import { Button } from "@zfunnel/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
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
        setError(error.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{isSignUp ? "Create your account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isSignUp ? "Start building funnels in minutes." : "Sign in to your ZFunnel account."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" autoComplete="name" required minLength={2} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={isSignUp ? 10 : undefined}
            />
            {isSignUp && <p className="text-xs text-muted-foreground">At least 10 characters.</p>}
          </div>
          <FormMessage message={error} />
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "New to ZFunnel? "}
            <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-medium text-primary hover:underline">
              {isSignUp ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
