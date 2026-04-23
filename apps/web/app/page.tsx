export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-bold text-gray-900">christina-crm</h1>
        <p className="mt-2 text-sm font-mono text-gray-500">Phase 0.1 — repo scaffold</p>
        <p className="mt-6 text-gray-600">
          Turborepo monorepo is live. Next steps: 0.2 AWS infra → 0.3 Postgres schema → 0.4
          WorkOS auth.
        </p>
        <div className="mt-8 flex flex-col gap-2 text-sm text-left bg-white border border-gray-200 rounded-lg p-4">
          <span className="font-medium text-gray-700">Health checks</span>
          <a href="/health" className="text-blue-600 hover:underline font-mono">
            GET /health
          </a>
          <a
            href="http://localhost:3001/health"
            className="text-blue-600 hover:underline font-mono"
          >
            GET :3001/health (API)
          </a>
        </div>
      </div>
    </main>
  );
}
