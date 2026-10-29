import { authApi } from "../models/users/auth";

// The browser calls these through Convex Auth's React hooks, as `api.auth`. The ones that start a
// session go through the web app's /auth/signin route (apps/web/src/server.ts), so the refresh
// token lands in an httpOnly cookie.
export const {
  signOut,
  refreshSession,
  signUpWithEmailPassword,
  completeSignUp,
  signInWithEmailPassword,
  startPasswordRecovery,
  checkPasswordRecovery,
  completePasswordRecovery,
} = authApi;
