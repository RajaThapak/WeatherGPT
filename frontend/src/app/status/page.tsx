'use client';

import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
  postgres: string;
  redis: string;
};

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    fetch(`${apiUrl}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main className="p-10 font-sans text-text-primary">
      <h1 className="text-2xl font-semibold mb-4">WeatherGPT — Stack Wiring Check</h1>
      {error && <p className="text-alert">Error reaching backend: {error}</p>}
      {!error && !health && <p>Checking backend health…</p>}
      {health && (
        <ul className="space-y-1">
          <li>Overall: {health.status}</li>
          <li>Postgres: {health.postgres}</li>
          <li>Redis: {health.redis}</li>
        </ul>
      )}
    </main>
  );
}
