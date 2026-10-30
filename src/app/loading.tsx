export default function Loading() {
  return (
    <main className="app-shell" aria-busy="true">
      <div className="loading-banner">
        <span className="loading-indicator" />
        Loading fleet workspace…
      </div>
    </main>
  );
}
