"use client";

import { useState } from "react";
import { useT } from "@/src/i18n/use-t";

const EYE_SHOW = (
  <svg className="icon-eye icon-eye--show" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EYE_HIDE = (
  <svg className="icon-eye icon-eye--hide" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

type Props = {
  id: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  testId?: string;
  plain?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange?: () => void;
};

export function PasswordField({ id, name, autoComplete, required, testId, plain, invalid, describedBy, onChange }: Props) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  if (plain) {
    return (
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required={required}
        minLength={8}
        data-testid={testId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={onChange}
      />
    );
  }

  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={8}
        data-testid={testId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={onChange}
      />
      <button
        type="button"
        className={`password-toggle${visible ? " is-revealed" : ""}`}
        aria-pressed={visible}
        aria-label={visible ? t("play.login.hide_password") : t("play.login.show_password")}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? EYE_HIDE : EYE_SHOW}
      </button>
    </div>
  );
}
