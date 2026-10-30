import Link from "next/link";

export function UnavailablePage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">F</div>
        <p className="eyebrow">FLEET WORKSPACE</p>
        <h1>Workspace not found</h1>
        <p className="muted">
          This workspace or vehicle is unavailable. It may not exist, or you may
          not have access.
        </p>
        <Link className="button secondary" href="/">Return to your workspace</Link>
      </section>
    </main>
  );
}
