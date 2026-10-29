import { useCompleteSignUp } from "@convex-dev/auth/methods/email-password/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard, FormError } from "#/components/auth-card";
import { api } from "#/lib/api";
import { AFTER_SIGN_IN, authErrorMessage } from "#/lib/auth";
import { pageMeta } from "#/lib/meta";

// The page of the link in the sign-up email. Opening it verifies the email and signs the user in.
export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: pageMeta("Verify your email") }),
  validateSearch: (search): { code: string } => ({
    code: typeof search.code === "string" ? search.code : "",
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { code } = Route.useSearch();
  const state = useCompleteSignUp(api.auth, { emailCode: code });

  useEffect(() => {
    if (state.status === "complete") location.assign(AFTER_SIGN_IN);
  }, [state.status]);

  if (state.status === "error") {
    return (
      <AuthCard
        title="Couldn't verify your email"
        footer={
          <>
            <Link to="/signin" className="underline">
              Sign in
            </Link>{" "}
            or{" "}
            <Link to="/signup" className="underline">
              sign up again
            </Link>
          </>
        }
      >
        <FormError>{authErrorMessage(state.userError)}</FormError>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Verifying your email…">
      <p className="text-sm text-muted-foreground">This takes a moment.</p>
    </AuthCard>
  );
}
