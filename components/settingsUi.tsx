"use client"

import { Icon } from "./ui/Icon"
import { ListCard, Sheet, cx } from "./ui/primitives"

/* Rows and groups shared by the profile and settings screens. */

/** Bottom drawer with one choice per row; picking closes it. */
export function ChoiceSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  value,
  onPick,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: { value: T; label: string }[]
  value: T
  onPick: (v: T) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ListCard>
        <div
          role="radiogroup"
          aria-label={title}
          className="flex flex-col [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={o.value === value}
              onClick={() => onPick(o.value)}
              className="flex min-h-[52px] w-full items-center gap-3 text-left"
            >
              <span className="grow text-[15px]">{o.label}</span>
              {o.value === value ? <Icon name="check" size={18} strokeWidth={2.4} className="text-income" /> : null}
            </button>
          ))}
        </div>
      </ListCard>
    </Sheet>
  )
}

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <ListCard>{children}</ListCard>
    </section>
  )
}

export function NavRow({
  label,
  value,
  onClick,
  icon,
}: {
  label: string
  value?: string
  onClick?: () => void
  icon?: "download"
}) {
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx("flex min-h-[52px] w-full items-center gap-3 text-left")}
    >
      <span className="grow text-[15px]">{label}</span>
      {value ? <span className="text-[13px] text-muted">{value}</span> : null}
      {onClick ? <Icon name={icon ?? "chevronRight"} size={16} strokeWidth={2} className="text-faint" /> : null}
    </Tag>
  )
}
