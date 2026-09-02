"use client";

import { useMemo } from "react";
import {
  buildNationalityOptions,
  filterNationalityOptions,
} from "@/src/core/nationality-options";
import { useLocale, useT } from "@/src/i18n/use-t";
import { ComboField } from "@/src/ui/combo-field";

type NationalitySelectProps = {
  id: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  labelKey: "play.register.nationality" | "play.profile.nationality";
};

export function NationalitySelect({
  id,
  testId,
  value,
  onChange,
  labelKey,
}: NationalitySelectProps) {
  const t = useT();
  const locale = useLocale();

  const options = useMemo(
    () =>
      buildNationalityOptions(locale).map((o) => ({
        value: o.code,
        label: o.label,
      })),
    [locale],
  );

  return (
    <ComboField
      id={id}
      testId={testId}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t("play.register.nationality_placeholder")}
      label={t(labelKey)}
      filterOptions={(opts, query) =>
        filterNationalityOptions(
          opts.map((o) => ({ code: o.value, label: o.label, pinned: false })),
          query,
        ).map((o) => ({ value: o.code, label: o.label }))
      }
      listAriaLabel={t("play.a11y.nationality_list")}
      toggleAriaLabel={t("play.a11y.nationality_toggle")}
    />
  );
}
