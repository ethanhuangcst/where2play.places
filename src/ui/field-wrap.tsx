"use client";

import { useT } from "@/src/i18n/use-t";

type Props = {
  field: string;
  label: React.ReactNode;
  errorKey?: string | null;
  className?: string;
  errorTestId?: string;
  children: React.ReactNode;
};

export function FieldWrap({ field, label, errorKey, className, errorTestId, children }: Props) {
  const t = useT();
  const errorId = `${field}-error`;
  const invalid = Boolean(errorKey);

  return (
    <div
      className={`field${invalid ? " is-invalid" : ""}${className ? ` ${className}` : ""}`}
      data-field={field}
    >
      {label}
      {children}
      {invalid ? (
        <p
          className="field-error"
          id={errorId}
          role="alert"
          data-field-error={field}
          data-testid={errorTestId}
        >
          {t(errorKey!)}
        </p>
      ) : null}
    </div>
  );
}

export function fieldDescribedBy(field: string, errorKey?: string | null): string | undefined {
  return errorKey ? `${field}-error` : undefined;
}
