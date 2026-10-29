import { useSignUpWithEmailPassword } from "@convex-dev/auth/methods/email-password/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { useState } from "react";
import { AuthCard, Field, FormError, PasswordField } from "#/components/auth-card";
import { api } from "#/lib/api";
import { authErrorMessage } from "#/lib/auth";
import { pageMeta } from "#/lib/meta";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: pageMeta("Sign up") }),
  component: SignUp,
});

function SignUp() {
  const { signUp, pending } = useSignUpWithEmailPassword(api.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Sign-up doesn't sign in: the first session starts on /verify-email, from the emailed link.
  if (sentTo !== null) {
    return (
      <AuthCard
        title="Check your email"
        description={`We sent a link to ${sentTo}. Open it in this browser to finish signing up.`}
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
      title="Sign up"
      footer={
        <>
          Have an account?{" "}
          <Link to="/signin" className="underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await signUp({ email, password });
          if (result.success) setSentTo(email);
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
        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending}>
          Sign up
        </Button>
      </form>
    </AuthCard>
  );
}
