/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as api_auth from "../api/auth.js";
import type * as api_notes from "../api/notes.js";
import type * as api_users from "../api/users.js";
import type * as internal_devMailbox from "../internal/devMailbox.js";
import type * as internal_seed from "../internal/seed.js";
import type * as internal_users from "../internal/users.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as models_devMailbox_functions from "../models/devMailbox/functions.js";
import type * as models_devMailbox_table from "../models/devMailbox/table.js";
import type * as models_notes_functions from "../models/notes/functions.js";
import type * as models_notes_table from "../models/notes/table.js";
import type * as models_seed_functions from "../models/seed/functions.js";
import type * as models_users_auth from "../models/users/auth.js";
import type * as models_users_functions from "../models/users/functions.js";
import type * as models_users_table from "../models/users/table.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "api/auth": typeof api_auth;
  "api/notes": typeof api_notes;
  "api/users": typeof api_users;
  "internal/devMailbox": typeof internal_devMailbox;
  "internal/seed": typeof internal_seed;
  "internal/users": typeof internal_users;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/rateLimits": typeof lib_rateLimits;
  "models/devMailbox/functions": typeof models_devMailbox_functions;
  "models/devMailbox/table": typeof models_devMailbox_table;
  "models/notes/functions": typeof models_notes_functions;
  "models/notes/table": typeof models_notes_table;
  "models/seed/functions": typeof models_seed_functions;
  "models/users/auth": typeof models_users_auth;
  "models/users/functions": typeof models_users_functions;
  "models/users/table": typeof models_users_table;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authEmail: import("@convex-dev/auth/components/email/_generated/component.js").ComponentApi<"authEmail">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
