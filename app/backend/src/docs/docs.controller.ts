import { Controller, Get, Post, Res } from "@nestjs/common";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { OpenApiDocumentHolder } from "../common/swagger/openapi-document.holder";

/**
 * Cursor pagination documentation served by the docs controller.
 *
 * The content is intentionally kept in code so it is versioned alongside the
 * API and can be asserted by automated tests. It documents opaque cursor
 * semantics, page limits, continuation termination, cursor expiry, and
 * invalid-cursor error responses for public paginated endpoints.
 */
export const CURSOR_PAGINATION_DOCUMENTATION = {
  title: "Cursor pagination",
  summary:
    "Public paginated endpoints use opaque, server-issued cursors. Clients must treat cursors as opaque strings and must never construct, parse, or modify them.",
  cursor: {
    opaque: true,
    description:
      "Cursors are opaque, URL-safe strings issued by the server. Their format is an implementation detail and may change without notice. Do not construct, decode, or mutate cursors.",
    rules: [
      "Only use cursors returned by the server in a previous response.",
      "Do not construct, parse, decode, or modify cursors.",
      "Treat cursors as case-sensitive and pass them through unchanged.",
      "Do not persist cursors beyond their expiry window.",
    ],
  },
  pageLimits: {
    description:
      "Clients may request a page size via the `limit` query parameter. The server clamps out-of-range values to the supported bounds.",
    defaultLimit: 20,
    minLimit: 1,
    maxLimit: 100,
    notes: [
      "Values below the minimum are clamped to the minimum.",
      "Values above the maximum are clamped to the maximum.",
      "The effective page size is reflected in the number of items returned.",
    ],
  },
  continuation: {
    description:
      "To fetch the next page, pass the `nextCursor` value from the previous response as the `cursor` query parameter. Pagination terminates when the response contains a null `nextCursor`.",
    termination:
      "Termination is explicit: when `nextCursor` is null (or absent), there are no further pages. Clients must stop requesting additional pages at that point.",
    rules: [
      "Start without a `cursor` parameter to fetch the first page.",
      "Pass the previous response's `nextCursor` as `cursor` to fetch the next page.",
      "Stop when `nextCursor` is null; do not request further pages.",
    ],
  },
  expiry: {
    description:
      "Cursors expire after a bounded time window. An expired cursor is rejected with an invalid-cursor error; clients should restart pagination from the first page.",
    ttlSeconds: 3600,
    notes: [
      "Cursor lifetime is limited and not guaranteed beyond the documented window.",
      "On expiry, restart pagination from the first page without a cursor.",
    ],
  },
  errors: {
    invalidCursor: {
      status: 400,
      code: "INVALID_CURSOR",
      message: "The provided cursor is invalid or has expired.",
      description:
        "Returned when the `cursor` query parameter is malformed, tampered with, or expired. Clients should restart pagination from the first page.",
    },
  },
  examples: {
    firstPageRequest: {
      method: "GET",
      path: "/items?limit=2",
      description: "Request the first page with an explicit page size.",
    },
    firstPageResponse: {
      status: 200,
      body: {
        items: [
          { id: "item_1", name: "First item" },
          { id: "item_2", name: "Second item" },
        ],
        nextCursor: "eyJvZmZzZXQiOjJ9.opaque",
      },
    },
    nextPageRequest: {
      method: "GET",
      path: "/items?limit=2&cursor=eyJvZmZzZXQiOjJ9.opaque",
      description:
        "Request the next page by passing the previous response's nextCursor as cursor.",
    },
    nextPageResponse: {
      status: 200,
      body: {
        items: [{ id: "item_3", name: "Third item" }],
        nextCursor: null,
      },
    },
    termination: {
      description:
        "The final page returns nextCursor: null. Clients must stop paginating.",
    },
    invalidCursorResponse: {
      status: 400,
      body: {
        code: "INVALID_CURSOR",
        message: "The provided cursor is invalid or has expired.",
      },
    },
  },
} as const;

/**
 * Exports the validated OpenAPI JSON specification used by CI to detect spec
 * divergence. Returns a copy of the document produced during bootstrap.
 *
 * Also serves the cursor pagination documentation section so consumers have a
 * consistent explanation of opaque cursors, page limits, continuation
 * termination, cursor expiry, and invalid-cursor errors.
 */
@ApiTags("docs")
@ApiExcludeController()
@Controller("docs")
export class DocsController {
  @Post("json")
  exportSpec(@Res() res: Response) {
    const document = OpenApiDocumentHolder.get().get();
    if (!document) {
      return res.status(503).json({
        code: "SPEC_NOT_READY",
        message: "OpenAPI document has not been generated yet.",
      });
    }
    return res.status(200).json(document);
  }

  @Get("pagination")
  getPaginationDocs(@Res() res: Response) {
    return res.status(200).json(CURSOR_PAGINATION_DOCUMENTATION);
  }
}