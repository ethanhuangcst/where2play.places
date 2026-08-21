"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { INTEREST_IDS, INTEREST_LABEL_KEYS, type InterestId, normalizeInterests } from "@/src/core/interests";
import { LocationField } from "@/src/ui/location-field";
import { RegisterPhotoBowl } from "@/src/ui/register-photo-bowl";
import { formatProfileTime } from "@/src/ui/format-profile-time";
import { useLocale, useT } from "@/src/i18n/use-t";
import { htmlLang } from "@/src/core/locales";
import { usePageTitle } from "@/src/ui/use-page-title";
import { authJson } from "@/src/ui/auth-api";
import { notifySessionChanged } from "@/src/ui/session-events";
import { FieldWrap } from "@/src/ui/field-wrap";

export default function ProfilePageClient() {
  const t = useT();
  const locale = useLocale();
  usePageTitle("play.profile.page_title");
  const timeLocale = htmlLang(locale);

  const [loaded, setLoaded] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [photoFieldError, setPhotoFieldError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [personal, setPersonal] = useState({
    name: "",
    email: "",
    gender: "",
    age: "",
    defaultLocation: "",
    defaultLat: null as number | null,
    defaultLng: null as number | null,
    photoUrl: null as string | null,
  });
  const [interests, setInterests] = useState<InterestId[]>([]);
  const savedRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (savedMsg) {
      savedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [savedMsg]);

  useEffect(() => {
    authJson<{
      name: string;
      email: string;
      gender?: string | null;
      age?: number | null;
      defaultLocation?: string | null;
      defaultLat?: number | null;
      defaultLng?: number | null;
      photoUrl?: string | null;
      interests?: string[];
      updatedAt?: string;
    }>("/api/profile/personal")
      .then((p) => {
        setPersonal({
          name: p.name ?? "",
          email: p.email ?? "",
          gender: p.gender ?? "",
          age: p.age != null ? String(p.age) : "",
          defaultLocation: p.defaultLocation ?? "",
          defaultLat: p.defaultLat ?? null,
          defaultLng: p.defaultLng ?? null,
          photoUrl: p.photoUrl ?? null,
        });
        setInterests(normalizeInterests(p.interests));
        setUpdatedAt(p.updatedAt);
      })
      .finally(() => setLoaded(true));
  }, []);

  function toggleInterest(id: InterestId) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function savePersonal(e: React.FormEvent) {
    e.preventDefault();
    setPhotoFieldError(null);
    const updated = await authJson<{ updatedAt?: string; interests?: string[]; photoUrl?: string | null }>(
      "/api/profile/personal",
      {
        method: "PUT",
        body: JSON.stringify({
          name: personal.name,
          email: personal.email,
          gender: personal.gender || undefined,
          age: personal.age ? Number(personal.age) : undefined,
          defaultLocation: personal.defaultLocation,
          defaultLat: personal.defaultLat,
          defaultLng: personal.defaultLng,
          photoUrl: personal.photoUrl ?? "",
          interests,
        }),
      },
    );
    setUpdatedAt(updated.updatedAt);
    if (updated.interests) setInterests(normalizeInterests(updated.interests));
    if (updated.photoUrl !== undefined) setPersonal((prev) => ({ ...prev, photoUrl: updated.photoUrl ?? null }));
    setSavedMsg(true);
    notifySessionChanged();
  }

  if (!loaded) return null;

  return (
    <main id="content" className="app-main app-main--profile" data-testid="profile-page">
      <h1 className="sr-only">{t("play.profile.page_title")}</h1>
      <div className="profile-stack">
        <div className="register-card">
          <header className="register-card__head">
            <h2>{t("play.profile.personal")}</h2>
            <p className="meta">{t("play.profile.personal_updated", { time: formatProfileTime(updatedAt, timeLocale) })}</p>
          </header>
          <form className="register-card__form" onSubmit={savePersonal} data-testid="profile-personal-form">
            <div className="register-card__grid">
              <div className="register-card__fields">
                <p className="register-required-note">{t("play.register.required_note")}</p>
                {savedMsg ? (
                  <p className="callout is-ok" ref={savedRef} role="status" data-profile-saved data-testid="profile-saved">
                    {t("play.profile.saved")}
                  </p>
                ) : null}
                <div className="field">
                  <label htmlFor="name" className="is-required">
                    {t("play.register.name")}
                  </label>
                  <input
                    id="name"
                    value={personal.name}
                    onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
                    required
                    data-testid="profile-name"
                  />
                </div>
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="email" className="is-required">
                      {t("play.register.email")}
                    </label>
                    <span className="field-label-note">{t("play.register.email_hint")}</span>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={personal.email}
                    onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                    required
                    data-testid="profile-email"
                  />
                </div>
                <div className="field-row field-row--demographics">
                  <div className="field field--gender">
                    <label htmlFor="gender">{t("play.register.gender")}</label>
                    <select
                      id="gender"
                      value={personal.gender}
                      onChange={(e) => setPersonal({ ...personal, gender: e.target.value })}
                    >
                      <option value="">{t("play.register.gender_skip")}</option>
                      <option value="female">{t("play.register.gender_female")}</option>
                      <option value="male">{t("play.register.gender_male")}</option>
                      <option value="other">{t("play.register.gender_other")}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="age">{t("play.register.age")}</label>
                    <input
                      id="age"
                      type="number"
                      min={13}
                      max={120}
                      value={personal.age}
                      onChange={(e) => setPersonal({ ...personal, age: e.target.value })}
                      data-testid="profile-age"
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="location" className="is-required">
                    {t("play.register.location")}
                  </label>
                  <LocationField
                    value={personal.defaultLocation}
                    onChange={(v) =>
                      setPersonal({
                        ...personal,
                        defaultLocation: v,
                        defaultLat: null,
                        defaultLng: null,
                      })
                    }
                    onResolved={(label, lat, lng) =>
                      setPersonal({
                        ...personal,
                        defaultLocation: label,
                        defaultLat: lat,
                        defaultLng: lng,
                      })
                    }
                    required
                    testId="field-location"
                    initialStatus={personal.defaultLocation ? "ok" : undefined}
                    action={
                      <Link className="btn btn-quiet" href="/reset-password">
                        {t("play.profile.reset_password")}
                      </Link>
                    }
                  />
                </div>
                <div className="field" data-testid="profile-interests">
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
                  errorKey={photoFieldError}
                  errorTestId="profile-photo-error"
                  label={
                    <p className="register-photo__eyebrow" id="photo-label">
                      {t("play.register.photo")}
                    </p>
                  }
                >
                  <RegisterPhotoBowl
                    photoUrl={personal.photoUrl}
                    onPhotoChange={(url) => {
                      setPersonal({ ...personal, photoUrl: url });
                      setPhotoFieldError(null);
                    }}
                    onPhotoError={(key) => setPhotoFieldError(key)}
                  />
                </FieldWrap>
              </aside>
            </div>
            <div className="register-card__actions">
              <button className="btn register-card__submit" type="submit" data-testid="profile-save">
                {t("play.profile.save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
