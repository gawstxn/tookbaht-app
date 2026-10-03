import type { Instrumentation } from "next"

/**
 * An error thrown on the server (a route handler, a render, the proxy): kept
 * and posted to the maintainers' Discord like the ones from the browser
 * (lib/errorServer.ts). Awaited, or the function is frozen before it is sent.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { recordError } = await import("@/lib/errorServer")
  const error = err instanceof Error ? err : new Error(String(err))
  await recordError(
    {
      source: "server",
      message: `${error.name}: ${error.message}`,
      stack: error.stack ?? "",
      page: `${request.method} ${context.routePath || request.path}`,
      appVersion: `${process.env.NEXT_PUBLIC_APP_VERSION} (${process.env.NEXT_PUBLIC_APP_COMMIT})`,
      userAgent: "",
    },
    null,
  )
}
