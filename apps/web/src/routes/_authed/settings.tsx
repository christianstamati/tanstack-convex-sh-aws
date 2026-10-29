import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "#/components/auth-card";
import { api } from "#/lib/api";
import { meQuery } from "#/lib/auth";
import { attempt } from "#/lib/errors";
import { pageMeta } from "#/lib/meta";

export const Route = createFileRoute("/_authed/settings")({
  head: () => ({ meta: pageMeta("Settings") }),
  // Usually in the cache already: the root route loads it for a page rendered as the user.
  loader: ({ context }) => context.queryClient.query({ ...meQuery, staleTime: "static" }),
  component: Settings,
});

function Settings() {
  const { data: me } = useSuspenseQuery(meQuery);
  const [name, setName] = useState(me?.name ?? "");
  const update = useMutation({ mutationFn: useConvexMutation(api.users.setName) });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6 pt-16">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Signed in as {me?.email}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await attempt(update.mutateAsync({ name }), "Couldn't save your name.")) {
                toast.success("Saved.");
              }
            }}
          >
            <Field
              label="Name"
              autoComplete="name"
              placeholder="Shown instead of your email"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" className="self-start" disabled={update.isPending}>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
