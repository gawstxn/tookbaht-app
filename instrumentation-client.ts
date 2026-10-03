import { reportError } from "@/lib/errorReport"

// Errors nobody caught, on any screen: a render that crashed, a promise that
// was rejected. Sent to the maintainers (lib/errorReport.ts), since most
// people who hit one never write in.
window.addEventListener("error", (event) => reportError("error", event.error ?? event.message))
window.addEventListener("unhandledrejection", (event) => reportError("rejection", event.reason))
