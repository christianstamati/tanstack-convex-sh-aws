import { useCompletePasswordRecovery } from "@convex-dev/auth/methods/email-password/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { useEffect, useState } from "react";
import { AuthCard, FormError, PasswordField } from "#/components/auth-card";
import { api } from "#/lib/api";
import { AFTER_SIGN_IN, authErrorMessage } from "#/lib/auth";
import { pageMeta } from "#/lib/meta";

// The page of the link in the password recovery email. Setting the new password signs the user in.
export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: pageMeta("Reset your password") }),
  validateSearch: (search): { code: string } => ({
    code: typeof search.code === "string" ? search.code : "",
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { code } = Route.useSearch();
  const state = useCompletePasswordRecovery(api.auth, { emailCode: code });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "complete") location.assign(AFTER_SIGN_IN);
  }, [state.status]);

  if (state.status === "error") {
    return (
      <AuthCard
        title="Couldn't reset your password"
        footer={
          <Link to="/forgot-password" className="underline">
            Request a new link
          </Link>
        }
      >
        <FormError>{authErrorMessage(state.userError)}</FormError>
      </AuthCard>
    );
  }
  if (state.status !== "ready") {
    return (
      <AuthCard title="Reset your password">
        <p className="text-sm text-muted-foreground">Checking your link…</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await state.completePasswordRecovery({ newPassword: password });
          if (result.status === "error") setError(authErrorMessage(result.userError));
        }}
      >
        <PasswordField
          label="New password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={state.pending}
        />
        <FormError>{error}</FormError>
        <Button type="submit" disabled={state.pending}>
          Save and sign in
        </Button>
      </form>
    </AuthCard>
  );
}
