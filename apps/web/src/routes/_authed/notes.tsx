// Example feature: delete this file (and the links on the home page and in the header) to remove it.
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "#/lib/api";
import { attempt } from "#/lib/errors";
import { pageMeta } from "#/lib/meta";

const notesQuery = convexQuery(api.notes.list);

export const Route = createFileRoute("/_authed/notes")({
  head: () => ({ meta: pageMeta("Notes") }),
  // Fetched during SSR as the user, then kept live by the Convex subscription.
  loader: ({ context }) => context.queryClient.query({ ...notesQuery, staleTime: "static" }),
  component: Notes,
});

function Notes() {
  const [text, setText] = useState("");
  const { data: notes } = useSuspenseQuery(notesQuery);
  const create = useMutation({ mutationFn: useConvexMutation(api.notes.create) });
  const remove = useMutation({ mutationFn: useConvexMutation(api.notes.remove) });

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-4 p-6 pt-16">
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Only you can see them. Stored in Convex and updated live.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (text.trim() === "") return;
              if (await attempt(create.mutateAsync({ text }), "Couldn't add the note.")) {
                setText("");
              }
            }}
          >
            <Input
              aria-label="New note"
              placeholder="Write a note…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit" disabled={create.isPending}>
              Add
            </Button>
          </form>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((note) => (
                <li key={note._id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="wrap-break-word">{note.text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending && remove.variables.id === note._id}
                    onClick={() =>
                      void attempt(
                        remove.mutateAsync({ id: note._id }),
                        "Couldn't delete the note.",
                      )
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
