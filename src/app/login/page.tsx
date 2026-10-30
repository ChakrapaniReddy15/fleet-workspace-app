import { SignInForm } from "../ui/forms";
import { demoCredentials } from "@/lib/supabase/env";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">F</div>
        <p className="eyebrow">FLEET WORKSPACE</p>
        <h1>Your fleet, in focus.</h1>
        <p className="muted">
          A private workspace for every fleet. Sign in to manage vehicles and
          keep their notes together.
        </p>
        <SignInForm />
        <div className="demo-box">
          <h2>Local demo accounts</h2>
          <p>All demo passwords: <code>FleetDemo2026!</code></p>
          {demoCredentials.map((credential) => (
            <p key={credential.role}>
              <strong>{credential.role}:</strong> {credential.email}
            </p>
          ))}
        </div>
      </section>
    </main>
  );
}
