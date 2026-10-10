export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center text-zinc-900">
      <div>
        <p className="text-sm font-semibold tracking-widest text-zinc-400 uppercase">404</p>
        <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-zinc-500">This page doesn&apos;t exist or hasn&apos;t been published.</p>
      </div>
    </main>
  );
}
