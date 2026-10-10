export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", color: "#18181b" }}>
      <div>
        <h1 style={{ fontSize: 24, margin: 0 }}>Page not found</h1>
        <p style={{ color: "#71717a" }}>This site doesn&apos;t exist or hasn&apos;t been published.</p>
      </div>
    </main>
  );
}
