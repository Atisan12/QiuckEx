import { Module } from "@nestjs/common";
import { DocsController } from "./docs.controller";

/**
 * Provides the POST /docs/json endpoint that exports the validated OpenAPI
 * specification (used by the CI spec-divergence check).
 *
 * Cursor pagination semantics for public APIs are documented in the OpenAPI
 * schema (opaque cursors, page limits, continuation/termination behavior,
 * cursor expiry and invalid-cursor errors) and surfaced through this module's
 * exported specification.
 */
@Module({
  controllers: [DocsController],
})
export class DocsModule {}