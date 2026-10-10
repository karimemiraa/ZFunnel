import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { subdomainFromHost } from "@/lib/host";
import { resolveWorkspace } from "@/lib/resolve";

/**
 * Phase 0: proves host → workspace routing. Phase 1.4 replaces the body with
 * rendering of the published page snapshot for the requested path.
 */
export default async function SitePage() {
  const host = (await headers()).get("host");
  const slug = subdomainFromHost(host, process.env.ROOT_DOMAIN ?? "zfunnel.app");
  if (!slug) notFound();
  const workspace = await resolveWorkspace(slug);
  if (!workspace) notFound();

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
        color: "#18181b",
      }}
    >
      <div>
        <h1 style={{ fontSize: 28, margin: 0 }}>{workspace.name}</h1>
        <p style={{ color: "#71717a" }}>Nothing has been published here yet.</p>
      </div>
    </main>
  );
}
