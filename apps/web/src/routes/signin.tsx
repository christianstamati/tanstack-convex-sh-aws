import { useSignInWithEmailPassword } from "@convex-dev/auth/methods/email-password/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { useState } from "react";
import { AuthCard, Field, FormError, PasswordField } from "#/components/auth-card";
import { api } from "#/lib/api";
import { AFTER_SIGN_IN, authErrorMessage, validateNext } from "#/lib/auth";
import { pageMeta } from "#/lib/meta";

export const Route = createFileRoute("/signin")({
  head: () => ({ meta: pageMeta("Sign in") }),
  validateSearch: validateNext,
  component: SignIn,
});

function SignIn() {
  // Checked again here: the search the component reads can still hold the raw `next`.
  const { next } = validateNext(Route.useSearch());
  const { signIn, pending } = useSignInWithEmailPassword(api.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          No account yet?{" "}
          <Link to="/signup" className="underline">
            Sign up
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await signIn({ email, password });
          if (result.status === "error") {
            setError(authErrorMessage(result.userError));
            return;
          }
          // A full page load, so the server renders the next page as the user.
          location.assign(next ?? AFTER_SIGN_IN);
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
        <PasswordField
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending}>
          Sign in
        </Button>
        <Link to="/forgot-password" className="text-center text-sm text-muted-foreground underline">
          Forgot your password?
        </Link>
      </form>
    </AuthCard>
  );
}
