"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Icon } from "@/components/ui/Icon"
import { PrimaryButton, Sheet, cx } from "@/components/ui/primitives"
import { AVATARS, NAME_MAX, avatarSrc, cleanName } from "@/lib/avatars"
import { useStore } from "@/lib/store"

/** The user's picked picture, or the first letter of their name on lime. */
export function Avatar({ name, avatar, size }: { name?: string; avatar?: string; size: number }) {
  const src = avatarSrc(avatar)
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny static files; next/image adds nothing here
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-lime font-bold text-on-lime"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name?.trim()[0] ?? "?").toUpperCase()}
    </span>
  )
}

/** Change the display name and pick a profile picture. */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t: tr } = useTranslation()
  return (
    <Sheet open={open} onClose={onClose} title={tr("profile.editTitle")}>
      {/* Remount per open so the form starts from the saved profile. */}
      {open ? <ProfileFields onDone={onClose} /> : null}
    </Sheet>
  )
}

function ProfileFields({ onDone }: { onDone: () => void }) {
  const { t: tr } = useTranslation()
  const user = useStore((s) => s.user)
  const settings = useStore((s) => s.settings)
  const updateProfile = useStore((s) => s.updateProfile)
  const [name, setName] = useState(user?.name ?? "")
  const [avatar, setAvatar] = useState<string | undefined>(avatarSrc(settings.avatar) ? settings.avatar : undefined)
  const clean = cleanName(name)

  return (
    <>
      <div className="flex items-center gap-3.5">
        <Avatar name={clean || user?.name} avatar={avatar} size={56} />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <label htmlFor="profilename" className="text-xs text-muted">
            {tr("profile.name")}
          </label>
          <input
            id="profilename"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            placeholder={tr("profile.namePlaceholder")}
            className="min-h-9 w-full border-b border-line-strong bg-transparent pb-1 font-serif text-[20px] font-bold outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-xs text-muted">{tr("profile.picture")}</span>
        <div role="radiogroup" aria-label={tr("profile.picture")} className="grid grid-cols-5 gap-2.5">
          <button
            type="button"
            role="radio"
            aria-checked={!avatar}
            aria-label={tr("profile.pictureInitial")}
            onClick={() => setAvatar(undefined)}
            className={cx(
              "relative aspect-square w-full self-start rounded-full border-2",
              !avatar ? "border-ink" : "border-transparent",
            )}
          >
            <span className="absolute inset-0.5 flex items-center justify-center rounded-full bg-lime text-lg font-bold text-on-lime">
              {(clean || user?.name || "?").trim()[0]?.toUpperCase() ?? "?"}
            </span>
          </button>
          {AVATARS.map((key, i) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={avatar === key}
              aria-label={tr("profile.pictureN", { n: i + 1 })}
              onClick={() => setAvatar(key)}
              className={cx(
                "relative aspect-square w-full self-start rounded-full border-2",
                avatar === key ? "border-ink" : "border-transparent",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny static files */}
              <img
                src={avatarSrc(key)!}
                alt=""
                draggable={false}
                loading="lazy"
                className="absolute inset-0.5 h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-full object-cover"
              />
              {avatar === key ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper"
                >
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <PrimaryButton
        once
        disabled={!clean}
        onClick={() => {
          updateProfile({ name: clean, avatar })
          onDone()
        }}
      >
        {tr("common.save")}
      </PrimaryButton>
    </>
  )
}
