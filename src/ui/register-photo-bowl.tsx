"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/src/i18n/use-t";
import { PHOTO_MAX_BYTES } from "@/src/auth/register-validation";

type Props = {
  photoUrl?: string | null;
  onPhotoChange?: (dataUrl: string | null, fileName: string | null) => void;
  onPhotoError?: (errorKey: string) => void;
};

export function RegisterPhotoBowl({ photoUrl, onPhotoChange, onPhotoError }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(photoUrl ? t("play.register.photo_choose") : null);

  useEffect(() => {
    if (photoUrl != null) {
      setPreview(photoUrl);
      setFileName(t("play.register.photo_choose"));
    }
  }, [photoUrl, t]);

  function openPicker() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > PHOTO_MAX_BYTES) {
      onPhotoError?.("play.errors.photo_too_large");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      setPreview(dataUrl);
      setFileName(file.name);
      onPhotoChange?.(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  }

  const hasPhoto = Boolean(preview);

  return (
    <div className="register-photo" data-testid="field-photo">
      <input
        ref={inputRef}
        id="photo"
        name="photo"
        type="file"
        accept="image/*"
        className="file-input-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />
      <button
        type="button"
        className={`register-photo__frame${hasPhoto ? " has-photo" : ""}`}
        data-photo-trigger
        onClick={openPicker}
      >
        {!hasPhoto ? (
          <>
            <span className="register-photo__steam" aria-hidden="true" />
            <span className="register-photo__placeholder" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </span>
            <span className="register-photo__cta">{t("play.register.photo_add")}</span>
          </>
        ) : (
          <img className="register-photo__img" src={preview!} alt="" />
        )}
      </button>
      <p className="register-photo__name">{fileName ?? t("play.register.photo_none")}</p>
    </div>
  );
}
