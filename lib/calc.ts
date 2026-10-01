/**
 * The add screen's keypad doubles as a small calculator: "120+85" saves 205.
 * Expressions use ASCII operators ("+", "-", "*"); the screen shows − and ×.
 */

export type CalcKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "del" | "+" | "-" | "*"

const OPS = ["+", "-", "*"]
const isOp = (c: string | undefined) => c !== undefined && OPS.includes(c)
const MAX_DIGITS = 9
const MAX_TERMS = 20

/** The number being typed (after the last operator). */
function lastTerm(expr: string): string {
  const i = Math.max(...OPS.map((o) => expr.lastIndexOf(o)))
  return expr.slice(i + 1)
}

/** Apply one key press to the expression. Keys that would make it invalid are ignored. */
export function pressKey(expr: string, key: CalcKey): string {
  if (key === "del") return expr.slice(0, -1)
  const term = lastTerm(expr)
  if (isOp(key)) {
    if (!expr) return expr
    const trimmed = expr.endsWith(".") ? expr.slice(0, -1) : expr
    if (isOp(trimmed.at(-1))) return trimmed.slice(0, -1) + key
    if (trimmed.split("").filter(isOp).length >= MAX_TERMS - 1) return expr
    return trimmed + key
  }
  if (key === ".") return term.includes(".") ? expr : expr + (term ? "." : "0.")
  const dot = term.indexOf(".")
  if (dot !== -1 && term.length - dot > 2) return expr
  if (term.replace(".", "").length >= MAX_DIGITS) return expr
  return term === "0" ? expr.slice(0, -1) + key : expr + key
}

/** True when the expression has an operator, i.e. there's a sum to show. */
export function hasOperator(expr: string): boolean {
  return expr.split("").some(isOp)
}

/** Value of the expression, rounded to satang. A trailing operator or dot is ignored. */
export function evaluate(expr: string): number {
  let s = expr
  while (s && (isOp(s.at(-1)) || s.endsWith("."))) s = s.slice(0, -1)
  if (!s) return 0
  const tokens = s.match(/\d+(?:\.\d*)?|[+\-*]/g) ?? []
  // Multiply first, then add and subtract left to right.
  const terms: number[] = []
  let sign = 1
  let product: number | null = null
  let pendingMul = false
  for (const tok of tokens) {
    if (tok === "+" || tok === "-") {
      if (product !== null) terms.push(sign * product)
      sign = tok === "-" ? -1 : 1
      product = null
      pendingMul = false
    } else if (tok === "*") {
      pendingMul = true
    } else {
      const n = parseFloat(tok)
      product = pendingMul && product !== null ? product * n : n
      pendingMul = false
    }
  }
  if (product !== null) terms.push(sign * product)
  const total = terms.reduce((a, b) => a + b, 0)
  return Math.round(total * 100) / 100
}

/** "1200+85.5" → "1,200 + 85.5" for display. */
export function formatExpr(expr: string): string {
  return expr.replace(/\d+(?:\.\d*)?|[+\-*]/g, (tok) => {
    if (tok === "+") return " + "
    if (tok === "-") return " − "
    if (tok === "*") return " × "
    const [i, d] = tok.split(".")
    return Number(i).toLocaleString("en-US") + (d !== undefined ? "." + d : "")
  })
}
