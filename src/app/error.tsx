"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">FLEET WORKSPACE</p>
        <h1>Something went wrong</h1>
        <p className="muted">
          We could not load this page. Your workspace data remains protected.
        </p>
        <button className="button primary" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
