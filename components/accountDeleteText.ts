import { t } from "@/lib/i18n"
import { accountDeleteBlock } from "@/lib/selectors"

/** The sentence shown instead of "Delete account" when it can't be deleted. */
export function deleteBlockedText(block: ReturnType<typeof accountDeleteBlock>): string | null {
  if (!block) return null
  if (block.reason === "last") return t("accounts.cantDeleteLast")
  const parts = [
    block.transactions ? t("accounts.usedTx", { count: block.transactions }) : "",
    block.schedules ? t("accounts.usedSchedules", { count: block.schedules }) : "",
  ].filter(Boolean)
  return t("accounts.cantDeleteUsed", { what: parts.join(t("accounts.and")) })
}
