import { authInternal } from "../models/users/auth";
import { usersInternal } from "../models/users/functions";

// Internal functions, called as `internal.users.<function>` with `internal` from
// convex/lib/api.refs.ts. Clients can't call them.
export const {
  createUser,
  onSignIn,
  removeUnverifiedUser,
  removeUnverifiedUsers,
  backfillVerifiedAt,
} = usersInternal;
export const { logEmail } = authInternal;
