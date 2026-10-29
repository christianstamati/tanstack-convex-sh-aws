# tanstack-convex-sh-aws

A public template for web apps on TanStack Start, Convex and Cloudflare Workers. Each product
starts as a copy of it in its own repo and grows on its own from there. These terms are the ones
every app built on it shares. A product made from this template keeps them, rewrites this
paragraph, and adds its own.

## Language

### People and sign-in

**User**:
One person in the app, and what their data belongs to. A **User** has one or more **Accounts**.
_Avoid_: member, profile, account (for the whole person)

**Account**:
One way a **User** signs in, such as an email and password, as Convex Auth defines it.
_Avoid_: login, credential, identity

**Session**:
One browser signed in as a **User**. A **User** has many **Sessions**; signing out ends only
that browser's **Session**, and resetting the password should end all the others.
_Avoid_: login, token

**Unverified user**:
A **User** who signed up but hasn't verified their email. They can't sign in, own no data, and
are deleted 24 hours after signing up. Counting or listing **Users** means verified ones only.
_Avoid_: pending user, inactive user

**Seed user**:
A sample **User** with a known password that exists only in **Local**, so a developer can sign
in without signing up.
_Avoid_: admin, test user, demo account

### Environments

Each environment pairs the web app with a Convex deployment.

**Local**:
The web app on a developer's machine, against that developer's own Convex dev deployment,
whether it runs on the machine or on Convex Cloud.
_Avoid_: dev environment

**Preview**:
One branch's Cloudflare Preview URL with its own Convex preview deployment, made on the branch's
first push. "Preview URL" and "preview deployment" name its two halves.
_Avoid_: staging, branch deploy

**Production**:
The Worker built from `main` with the Convex production deployment.
_Avoid_: live, prod (in prose)

### Template tooling

**Dev mailbox**:
Where **Local** keeps the auth emails it would have sent, so a developer or agent can open their
links.
_Avoid_: inbox, outbox, email log

**Example feature**:
The notes list: code that shows the wiring from table to page, and that a product deletes first.
A note is not a domain concept.
_Avoid_: demo, sample app

## Example dialogue

**Dev:** A **User** says they reset their password but their laptop is still signed in.

**Expert:** Expected for now. The reset ends nothing: each **Session** is one browser, and the
beta can't end all of a **User**'s **Sessions** yet.

**Dev:** And if they'd signed in with GitHub too, would that be a second **User**?

**Expert:** No, a second **Account** on the same **User**. Their data stays in one place.

**Dev:** The signup count on **Production** jumped. Real people?

**Expert:** Check they're verified. **Unverified users** count for nothing and are gone after a
day.

**Dev:** I need to try the reset email on my machine.

**Expert:** In **Local** nothing is sent; open the link from the **Dev mailbox**. Or sign in as
the **Seed user** if you only need someone signed in.

## Flagged ambiguities

- "Admin" was used for the **Seed user**. The template has no roles: every **User** can do the
  same things. Roles belong to the product.
- "Account" meant the whole person in places. It means one sign-in method of a **User**. UI copy
  may still say "your account" to the person signing in.
- `convex:auth --preview` sets the preview defaults that each new preview deployment copies, not
  the variables of any one **Preview**.
