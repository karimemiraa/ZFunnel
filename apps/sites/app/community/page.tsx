import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { spacesFor } from "@/lib/community";
import { currentCustomer } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { LoginForm } from "../account/account-client";

export const metadata: Metadata = { title: "Community", robots: { index: false } };

export default async function CommunityHome() {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const me = await currentCustomer(ws.id);
  if (!me)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 text-zinc-900">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-zinc-500">{ws.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Community</h1>
          <p className="mt-2 mb-6 text-sm text-zinc-600">Sign in to join the conversation.</p>
          <LoginForm next="/community" />
        </div>
      </main>
    );
  const spaces = await spacesFor(ws.id, me.id);
  if (spaces[0]) redirect(`/community/${spaces[0].slug}`);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 text-center text-zinc-600">
      <p>There are no community spaces you can access yet.</p>
    </main>
  );
}
