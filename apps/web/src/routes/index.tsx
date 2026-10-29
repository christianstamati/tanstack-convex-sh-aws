import { useSuspenseQuery } from "@tanstack/react-query";
import { buttonVariants } from "@workspace/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { meQuery } from "#/lib/auth";

export const Route = createFileRoute("/")({
  // Usually in the cache already: the root route loads it, as null without a session.
  loader: ({ context }) => context.queryClient.query({ ...meQuery, staleTime: "static" }),
  component: Home,
});

function Home() {
  const { data: me } = useSuspenseQuery(meQuery);

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-6">
      {me && <p className="text-lg">Hi, {me.name || me.email || "there"}!</p>}
      <h1 className="text-2xl font-semibold">tanstack-convex-sh-aws</h1>
      <p className="text-muted-foreground">TanStack Start, Convex and shadcn/ui on Base UI.</p>
      <div className="flex gap-2">
        <Link to="/notes" className={buttonVariants()}>
          Notes
        </Link>
      </div>
    </main>
  );
}
