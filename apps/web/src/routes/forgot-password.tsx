import { useStartPasswordRecovery } from "@convex-dev/auth/methods/email-password/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { useState } from "react";
import { AuthCard, Field, FormError } from "#/components/auth-card";
import { api } from "#/lib/api";
import { authErrorMessage } from "#/lib/auth";
import { pageMeta } from "#/lib/meta";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: pageMeta("Forgot your password") }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const { startPasswordRecovery, pending } = useStartPasswordRecovery(api.auth);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo !== null) {
    return (
      <AuthCard
        title="Check your email"
        description={`If an account uses ${sentTo}, we sent it a link. Open it in this browser within 10 minutes to choose a new password.`}
      >
        {import.meta.env.DEV && (
          <p className="text-sm text-muted-foreground">
            Without RESEND_API_KEY on the deployment, the email is in the output of `bun run dev`.
          </p>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link to choose a new one."
      footer={
        <Link to="/signin" className="underline">
          Back to sign in
        </Link>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await startPasswordRecovery({ email });
          // An unknown email gets the same answer as a known one, so the page doesn't say which
          // addresses have accounts.
          if (result.success || result.userError.error === "EMAIL_NOT_FOUND") setSentTo(email);
          else setError(authErrorMessage(result.userError));
        }}
      >
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
        />
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending}>
          Send link
        </Button>
      </form>
    </AuthCard>
  );
}
