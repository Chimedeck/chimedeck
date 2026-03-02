export default function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-900 text-white">
      <h1 className="text-6xl font-bold text-gray-500">404</h1>
      <p className="text-xl text-gray-300">Page not found</p>
      <a href="/workspaces" className="text-blue-400 hover:underline">
        Back to workspaces
      </a>
    </div>
  );
}
