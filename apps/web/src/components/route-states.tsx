import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { LoaderCircleIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The layout of the error and not-found pages. */
function StatePage({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6 pt-16">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="text-muted-foreground">{description}</div>
      <div className="flex gap-2">{actions}</div>
    </main>
  );
}

/**
 * The router's `defaultErrorComponent`: a loader, `beforeLoad` or render threw. On the root
 * route it renders without the header, whose session may be what failed.
 */
export function ErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <StatePage
      title="Something went wrong"
      description={
        <>
          <p>The page couldn't load. Try again, or go back home.</p>
          {/* Only in development: production errors can carry server details. */}
          {import.meta.env.DEV && (
            <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          )}
        </>
      }
      actions={
        <>
          {/* Runs the loaders again and resets the error boundaries. */}
          <Button onClick={() => void router.invalidate()}>Try again</Button>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Home
          </Link>
        </>
      }
    />
  );
}

/** The router's `defaultNotFoundComponent`: no route matches the URL, or a loader threw `notFound()`. */
export function NotFoundPage() {
  return (
    <StatePage
      title="Page not found"
      description={<p>There's no page at this address.</p>}
      actions={
        <Link to="/" className={buttonVariants()}>
          Home
        </Link>
      }
    />
  );
}

/** The router's `defaultPendingComponent`: shown when a navigation's loaders take over a second. */
export function PendingPage() {
  return (
    <main className="flex justify-center p-6 pt-16" aria-busy="true">
      <LoaderCircleIcon
        className="size-6 animate-spin text-muted-foreground"
        aria-label="Loading"
      />
    </main>
  );
}
