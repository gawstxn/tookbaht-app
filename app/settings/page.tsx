"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PushScreen } from "@/components/app"
import { CycleDaySheet } from "@/components/CycleDaySheet"
import { LockSettings } from "@/components/LockSettings"
import { PushToggle } from "@/components/PushToggle"
import { StorageSettings } from "@/components/StorageSettings"
import { ChoiceSheet, Group, NavRow } from "@/components/settingsUi"
import { PushHeader, SwitchRow } from "@/components/ui/primitives"
import { readLock } from "@/lib/appLock"
import { currentLang, type Lang } from "@/lib/i18n"
import { useGoBack } from "@/lib/nav"
import { useStartDay, useStore } from "@/lib/store"
import { setThemePref, themePref, type ThemePref } from "@/lib/theme"

/** Everything about how the app behaves: display, when the month starts, app lock, notifications and what is kept on the device. */
export default function SettingsPage() {
  const { t: tr } = useTranslation()
  const goBack = useGoBack("/profile")
  const settings = useStore((s) => s.settings)
  const setLanguage = useStore((s) => s.setLanguage)
  const setSettings = useStore((s) => s.setSettings)
  const notify = useStore((s) => s.notify)
  const [sheet, setSheet] = useState<"" | "lang" | "theme" | "lock" | "cycle">("")
  const startDay = useStartDay()
  // Per-device settings, read after mount.
  const [lock, setLock] = useState(readLock)
  const [theme, setTheme] = useState<ThemePref>(themePref)
  const langOptions: { value: Lang; label: string }[] = [
    { value: "th", label: tr("lang.th") },
    { value: "en", label: tr("lang.en") },
  ]
  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: "light", label: tr("theme.light") },
    { value: "dark", label: tr("theme.dark") },
    { value: "system", label: tr("theme.system") },
  ]

  return (
    <PushScreen>
      <PushHeader title={tr("settings.title")} onBack={goBack} />

      <Group title={tr("profile.display")}>
        <NavRow
          label={tr("lang.title")}
          value={langOptions.find((o) => o.value === currentLang())?.label}
          onClick={() => setSheet("lang")}
        />
        <NavRow
          label={tr("theme.title")}
          value={themeOptions.find((o) => o.value === theme)?.label}
          onClick={() => setSheet("theme")}
        />
        <SwitchRow
          label={tr("profile.keypadMath")}
          hint={tr("profile.keypadMathHint")}
          checked={settings.keypadMath !== false}
          onChange={(on) => {
            setSettings({ keypadMath: on })
            notify(on ? tr("profile.keypadMathOn") : tr("profile.keypadMathOff"))
          }}
        />
      </Group>

      <Group title={tr("payCycle.group")}>
        <NavRow
          label={tr("payCycle.row")}
          value={startDay === 1 ? tr("payCycle.calendar") : String(startDay)}
          onClick={() => setSheet("cycle")}
        />
      </Group>

      <Group title={tr("lock.group")}>
        <NavRow
          label={tr("lock.row")}
          value={!lock ? tr("lock.off") : lock.credentialId ? tr("lock.onBiometric") : tr("lock.onPin")}
          onClick={() => setSheet("lock")}
        />
      </Group>

      <Group title={tr("profile.notifications")}>
        <PushToggle />
        <SwitchRow
          label={tr("summary.label")}
          hint={tr("summary.hint")}
          checked={settings.monthlySummary !== false}
          onChange={(on) => {
            setSettings({ monthlySummary: on })
            notify(on ? tr("summary.on") : tr("summary.off"))
          }}
        />
        <SwitchRow
          label={tr("reminder.label")}
          hint={tr("reminder.hint")}
          checked={settings.dailyReminder === true}
          onChange={(on) => {
            setSettings({ dailyReminder: on })
            notify(on ? tr("reminder.on") : tr("reminder.off"))
          }}
        />
      </Group>

      <Group title={tr("storage.group")}>
        <StorageSettings />
      </Group>

      <ChoiceSheet
        open={sheet === "lang"}
        onClose={() => setSheet("")}
        title={tr("lang.title")}
        options={langOptions}
        value={currentLang()}
        onPick={(v) => {
          setSheet("")
          setLanguage(v)
        }}
      />
      <ChoiceSheet
        open={sheet === "theme"}
        onClose={() => setSheet("")}
        title={tr("theme.title")}
        options={themeOptions}
        value={theme}
        onPick={(v) => {
          setSheet("")
          setTheme(v)
          setThemePref(v)
        }}
      />

      <CycleDaySheet
        open={sheet === "cycle"}
        value={startDay}
        onClose={() => setSheet("")}
        onSave={(day) => {
          setSheet("")
          setSettings({ cycleStartDay: day })
          notify(tr("payCycle.saved", { day }))
        }}
      />
      <LockSettings open={sheet === "lock"} onClose={() => setSheet("")} onChange={setLock} />
    </PushScreen>
  )
}
