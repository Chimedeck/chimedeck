export default function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg-base text-base">
      <h1 className="text-6xl font-bold text-subtle">404</h1>
      <p className="text-xl text-muted">Page not found</p>
      <a href="/workspaces" className="text-link hover:underline">
        Back to workspaces
      </a>
    </div>
  );
}
