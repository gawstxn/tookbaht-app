/**
 * What goes with a PromptPay QR sent to a friend: the debts it covers, on the
 * shared image and in the message. Long lists are cut to a few lines plus a
 * count, so the image stays readable in a chat.
 */

export interface PayItem {
  label: string
  amount: number
}

/** Items to show, oldest first as given, and how many were left out. */
export function payItems(items: PayItem[], max = 6): { shown: PayItem[]; more: number } {
  // Showing "1 more" takes a line anyway: show the item instead.
  if (items.length <= max) return { shown: items, more: 0 }
  return { shown: items.slice(0, max - 1), more: items.length - (max - 1) }
}

/** The message to paste into a chat: the ask, one line per debt, then how many more. */
export function payMessage(
  head: string,
  items: PayItem[],
  line: (i: PayItem) => string,
  more: (n: number) => string,
  max = 6,
): string {
  // A single debt is already said by the head line.
  if (items.length < 2) return head
  const { shown, more: rest } = payItems(items, max)
  return [head, ...shown.map(line), ...(rest ? [more(rest)] : [])].join("\n")
}
