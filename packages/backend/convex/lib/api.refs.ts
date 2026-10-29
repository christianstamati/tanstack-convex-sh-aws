// The backend's references to its own functions, as apps/web/src/lib/api.ts has them for the web
// app. The second dot in the file name keeps Convex from treating this file as a module of
// functions, so it isn't part of the generated API's type, which would make these types circular.
import { api as generatedApi, components, internal as generatedInternal } from "../_generated/api";

/** The public functions in convex/api/, called as `api.<table>.<function>`. */
export const api = generatedApi.api;

/** The internal functions in convex/internal/, called as `internal.<table>.<function>`. */
export const internal = generatedInternal.internal;

/** The installed components, such as `components.authEmail`. */
export { components };
