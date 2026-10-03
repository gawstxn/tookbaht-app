import "server-only"
import { postToDiscord } from "./discord"
import { errorEmbed, errorRecord, type ErrorInput } from "./errorText"
import { createSupabaseAdmin } from "./supabase/admin"

/**
 * Keep one occurrence of an error and tell the maintainers when it is new
 * (or has grown tenfold). `userId` counts how many people met it; null for
 * an error on the server. Never throws: reporting an error must not cause one.
 */
export async function recordError(input: ErrorInput, userId: string | null): Promise<void> {
  try {
    const record = errorRecord(input)
    if (!record) return
    const { data, error } = await createSupabaseAdmin().rpc("report_error", {
      p_user: userId,
      p_fingerprint: record.fingerprint,
      p_source: record.source,
      p_message: record.message,
      p_stack: record.stack,
      p_page: record.page,
      p_app_version: record.appVersion,
      p_device: record.device,
    })
    if (error) {
      console.error("report_error failed", error.message)
      return
    }
    // No row: over the day's limits.
    const row = (data as { count: number; users: number; notify: boolean }[] | null)?.[0]
    if (row?.notify) await postToDiscord("errors", [errorEmbed(record, row.count, row.users)])
  } catch (e) {
    console.error("recording an error failed", (e as Error).message)
  }
}
