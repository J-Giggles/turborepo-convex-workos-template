/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers_auth from "../_helpers/auth.js";
import type * as aggregates from "../aggregates.js";
import type * as crons from "../crons.js";
import type * as domains from "../domains.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as organizations from "../organizations.js";
import type * as posts from "../posts.js";
import type * as rateLimits from "../rateLimits.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as tenant from "../tenant.js";
import type * as workosSync from "../workosSync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_helpers/auth": typeof _helpers_auth;
  aggregates: typeof aggregates;
  crons: typeof crons;
  domains: typeof domains;
  http: typeof http;
  integrations: typeof integrations;
  members: typeof members;
  migrations: typeof migrations;
  organizations: typeof organizations;
  posts: typeof posts;
  rateLimits: typeof rateLimits;
  scheduledJobs: typeof scheduledJobs;
  tenant: typeof tenant;
  workosSync: typeof workosSync;
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
  workOSAuthKit: import("@convex-dev/workos-authkit/_generated/component.js").ComponentApi<"workOSAuthKit">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  postsByOrg: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"postsByOrg">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
