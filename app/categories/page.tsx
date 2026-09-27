"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PushScreen, TxIcon } from "@/components/app";
import { CategoryEditSheet, MAX_CUSTOM_CATEGORIES, type CategoryDraft } from "@/components/CategoryEditSheet";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Empty, ListCard, PrimaryButton, PushHeader, Segmented } from "@/components/ui/primitives";
import { useGoBack } from "@/lib/nav";
import { useStore } from "@/lib/store";
import type { CustomCategory } from "@/lib/types";

/** The user's own categories, next to the built-in ones in every picker. */
export default function CategoriesPage() {
  const { t } = useTranslation();
  const goBack = useGoBack("/profile");
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const notify = useStore((s) => s.notify);
  const [type, setType] = useState<"out" | "in">("out");
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [deleting, setDeleting] = useState<CustomCategory | null>(null);
  const all = settings.customCategories ?? [];
  const shown = all.filter((c) => c.type === type && !c.hidden);

  const remove = (c: CustomCategory) => {
    // Hidden rather than dropped, so entries already in it keep their name.
    const before = useStore.getState().settings.customCategories ?? [];
    setSettings({ customCategories: before.map((x) => (x.key === c.key ? { ...x, hidden: true } : x)) });
    notify(t("cats.deleted", { name: c.label }), {
      action: { label: t("common.undo"), run: () => setSettings({ customCategories: before }) },
    });
  };

  return (
    <PushScreen>
      <PushHeader title={t("cats.title")} onBack={goBack} />
      <Segmented
        label={t("cats.title")}
        value={type}
        onChange={setType}
        options={[
          { value: "out", label: t("type.out") },
          { value: "in", label: t("type.in") },
        ]}
      />
      {shown.length ? (
        <ListCard>
          {shown.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setDraft({ key: c.key, type: c.type, label: c.label, icon: c.icon as IconName })}
              className="flex min-h-[56px] w-full items-center gap-3 text-left"
            >
              <TxIcon type={c.type} category={c.key} size={34} />
              <span className="grow truncate text-[15px]">{c.label}</span>
              <Icon name="chevronRight" size={16} strokeWidth={2} className="text-faint" />
            </button>
          ))}
        </ListCard>
      ) : (
        <Empty>{t("cats.empty")}</Empty>
      )}
      <p className="text-center text-xs leading-relaxed text-muted">{t("cats.hint")}</p>
      <div className="mt-auto">
        <PrimaryButton disabled={all.filter((c) => !c.hidden).length >= MAX_CUSTOM_CATEGORIES} onClick={() => setDraft({ type, label: "", icon: "tag" })}>
          {t("cats.add")}
        </PrimaryButton>
      </div>

      <CategoryEditSheet
        draft={draft}
        onClose={() => setDraft(null)}
        onDelete={(key) => {
          setDeleting(all.find((c) => c.key === key) ?? null);
          setDraft(null);
        }}
      />
      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("cats.deleteTitle", { name: deleting?.label ?? "" })}
        lead={t("cats.deleteLead")}
        confirmLabel={t("cats.delete")}
        onConfirm={() => {
          if (deleting) remove(deleting);
          setDeleting(null);
        }}
      />
    </PushScreen>
  );
}
