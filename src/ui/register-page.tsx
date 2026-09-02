"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useT } from "@/src/i18n/use-t";
import {
  firstRegisterField,
  mapApiErrorToField,
  type RegisterField,
  validateRegisterClient,
} from "@/src/auth/register-validation";
import { INTEREST_IDS, INTEREST_LABEL_KEYS, type InterestId } from "@/src/core/interests";
import { authJson, AuthApiError } from "@/src/ui/auth-api";
import { PublicShell } from "@/src/ui/public-shell";
import { LogoLink } from "@/src/ui/logo-link";
import { LocaleSwitch } from "@/src/ui/locale-switch";
import { PasswordField } from "@/src/ui/password-field";
import { LocationField } from "@/src/ui/location-field";
import { RegisterPhotoBowl } from "@/src/ui/register-photo-bowl";
import { NationalitySelect } from "@/src/ui/nationality-select";
import { usePageTitle } from "@/src/ui/use-page-title";
import { FieldWrap, fieldDescribedBy } from "@/src/ui/field-wrap";
import { notifySessionChanged } from "@/src/ui/session-events";

function focusRegisterField(field: RegisterField) {
  if (field === "photo") {
    const el = document.querySelector<HTMLElement>("[data-photo-trigger], .register-photo__frame");
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const id = field === "password_confirm" ? "password_confirm" : field;
  const el = document.getElementById(id);
  el?.focus();
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function RegisterPageClient() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  usePageTitle("play.register.title");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [nationality, setNationality] = useState("");

  function toggleInterest(id: InterestId) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearField(field: RegisterField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  function applyClientErrors(errors: Partial<Record<RegisterField, string>>) {
    setFieldErrors(errors);
    setFormError(null);
    const first = firstRegisterField(errors);
    if (first) focusRegisterField(first);
  }

  function applyApiError(err: unknown) {
    if (err instanceof AuthApiError) {
      const mapped = mapApiErrorToField(err.key, err.field);
      const field = mapped.field;
      if (mapped.formLevel || !field) {
        setFieldErrors({});
        setFormError(mapped.errorKey);
        return;
      }
      setFieldErrors({ [field]: mapped.errorKey });
      setFormError(null);
      focusRegisterField(field);
      return;
    }
    setFieldErrors({});
    setFormError("play.errors.network");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      age: String(fd.get("age") ?? ""),
      password: String(fd.get("password") ?? ""),
      confirmPassword: String(fd.get("password_confirm") ?? ""),
      nationality: nationality || undefined,
    };
    const clientErrors = validateRegisterClient(input);
    if (Object.keys(clientErrors).length > 0) {
      applyClientErrors(clientErrors);
      return;
    }
    const loc = String(fd.get("location") ?? "").trim();
    const body = {
      name: input.name,
      email: input.email,
      gender: fd.get("gender") || undefined,
      nationality: nationality || undefined,
      age: input.age || undefined,
      defaultLocation: loc || undefined,
      defaultLat: locationLat ?? undefined,
      defaultLng: locationLng ?? undefined,
      password: input.password,
      confirmPassword: input.confirmPassword,
      locale,
      interests,
      photoUrl: photoUrl || undefined,
    };
    try {
      await authJson("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
      notifySessionChanged();
      router.push("/plan");
      router.refresh();
    } catch (err) {
      applyApiError(err);
    }
  }

  return (
    <PublicShell localeCorner={false}>
      <div className="register-shell">
        <header className="register-topbar">
          <LogoLink href="/" />
          <LocaleSwitch />
        </header>
        <main id="content" className="auth-main auth-main--register">
          <div className="register-card">
            <header className="register-card__head">
              <h1>{t("play.register.title")}</h1>
            </header>
            <form className="register-card__form" onSubmit={onSubmit} data-testid="auth-form-register" noValidate>
              <div className="register-card__grid">
                <div className="register-card__fields">
                  <p className="register-required-note">{t("play.register.required_note")}</p>
                  {formError ? (
                    <p className="error" role="alert" data-testid="auth-form-error">
                      {t(formError)}
                    </p>
                  ) : null}
                  <FieldWrap
                    field="name"
                    errorKey={fieldErrors.name}
                    label={
                      <label htmlFor="name" className="is-required">
                        {t("play.register.name")}
                      </label>
                    }
                  >
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      data-testid="field-name"
                      aria-invalid={fieldErrors.name ? true : undefined}
                      aria-describedby={fieldDescribedBy("name", fieldErrors.name)}
                      onChange={() => clearField("name")}
                    />
                  </FieldWrap>
                  <FieldWrap
                    field="email"
                    errorKey={fieldErrors.email}
                    errorTestId="field-email-error"
                    label={
                      <div className="field-label-row">
                        <label htmlFor="email" className="is-required">
                          {t("play.register.email")}
                        </label>
                        <span className="field-label-note">{t("play.register.email_hint")}</span>
                      </div>
                    }
                  >
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      data-testid="field-email"
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={fieldDescribedBy("email", fieldErrors.email)}
                      onChange={() => clearField("email")}
                    />
                  </FieldWrap>
                  <div className="field-row field-row--demographics">
                    <div className="field field--gender">
                      <label htmlFor="gender">{t("play.register.gender")}</label>
                      <select id="gender" name="gender" defaultValue="">
                        <option value="">{t("play.register.gender_skip")}</option>
                        <option value="female">{t("play.register.gender_female")}</option>
                        <option value="male">{t("play.register.gender_male")}</option>
                        <option value="other">{t("play.register.gender_other")}</option>
                      </select>
                    </div>
                    <FieldWrap
                      field="age"
                      errorKey={fieldErrors.age}
                      label={<label htmlFor="age">{t("play.register.age")}</label>}
                    >
                      <input
                        id="age"
                        name="age"
                        type="number"
                        min={13}
                        max={120}
                        data-testid="field-age"
                        onChange={() => clearField("age")}
                      />
                    </FieldWrap>
                  </div>
                  <NationalitySelect
                    id="nationality"
                    testId="register-nationality"
                    value={nationality}
                    onChange={(v) => {
                      setNationality(v);
                      clearField("nationality");
                    }}
                    labelKey="play.register.nationality"
                  />
                  {fieldErrors.nationality ? (
                    <p className="error" role="alert" data-testid="field-nationality-error">
                      {t(fieldErrors.nationality)}
                    </p>
                  ) : null}
                  <div className="field">
                    <label htmlFor="location">{t("play.register.location")}</label>
                    <LocationField
                      value={location}
                      onChange={setLocation}
                      onResolved={(label, lat, lng) => {
                        setLocation(label);
                        setLocationLat(lat);
                        setLocationLng(lng);
                      }}
                      testId="field-location"
                    />
                  </div>
                  <FieldWrap
                    field="password"
                    errorKey={fieldErrors.password}
                    label={
                      <label htmlFor="password" className="is-required">
                        {t("play.register.password")}
                      </label>
                    }
                  >
                    <PasswordField
                      id="password"
                      name="password"
                      autoComplete="new-password"
                      required
                      testId="field-password"
                      invalid={Boolean(fieldErrors.password)}
                      describedBy={fieldDescribedBy("password", fieldErrors.password)}
                      onChange={() => clearField("password")}
                    />
                  </FieldWrap>
                  <FieldWrap
                    field="password_confirm"
                    errorKey={fieldErrors.password_confirm}
                    label={
                      <label htmlFor="password_confirm" className="is-required">
                        {t("play.register.password_confirm")}
                      </label>
                    }
                  >
                    <PasswordField
                      id="password_confirm"
                      name="password_confirm"
                      autoComplete="new-password"
                      required
                      testId="field-confirm-password"
                      invalid={Boolean(fieldErrors.password_confirm)}
                      describedBy={fieldDescribedBy("password_confirm", fieldErrors.password_confirm)}
                      onChange={() => clearField("password_confirm")}
                    />
                  </FieldWrap>
                  <div className="field" data-testid="register-interests">
                    <span className="field-label">{t("play.register.interests")}</span>
                    <div className="chip-row" role="group" aria-label={t("play.register.interests")}>
                      {INTEREST_IDS.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={`chip${interests.includes(id) ? " is-on" : ""}`}
                          data-interest={id}
                          data-testid={`interest-${id}`}
                          aria-pressed={interests.includes(id)}
                          onClick={() => toggleInterest(id)}
                        >
                          {t(INTEREST_LABEL_KEYS[id])}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <aside className="register-card__photo" aria-labelledby="photo-label">
                  <FieldWrap
                    field="photo"
                    errorKey={fieldErrors.photo}
                    errorTestId="field-photo-error"
                    label={
                      <p className="register-photo__eyebrow" id="photo-label">
                        {t("play.register.photo")}
                      </p>
                    }
                  >
                    <RegisterPhotoBowl
                      onPhotoChange={(url) => {
                        setPhotoUrl(url);
                        clearField("photo");
                      }}
                      onPhotoError={(key) => {
                        setFieldErrors((prev) => ({ ...prev, photo: key }));
                        setFormError(null);
                      }}
                    />
                  </FieldWrap>
                </aside>
              </div>
              <div className="register-card__actions">
                <button className="btn register-card__submit" type="submit" data-testid="register-submit">
                  {t("play.register.submit")}
                </button>
                <p className="auth-links">
                  <Link href="/login">{t("play.register.has_account")}</Link>
                </p>
              </div>
            </form>
          </div>
        </main>
      </div>
    </PublicShell>
  );
}
