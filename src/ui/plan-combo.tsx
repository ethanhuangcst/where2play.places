"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  id: string;
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Fired on blur when the field is empty (required combos can restore a default). */
  onBlurEmpty?: () => void;
  placeholder?: string;
  toggleLabel: string;
  disabled?: boolean;
  required?: boolean;
  testId?: string;
};

export function PlanCombo({
  id,
  name,
  value,
  options,
  onChange,
  onBlurEmpty,
  placeholder,
  toggleLabel,
  disabled,
  required,
  testId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="combo" data-combo ref={rootRef}>
      <input
        id={id}
        name={name}
        value={focused ? draft : value}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        disabled={disabled}
        data-testid={testId}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          onChange(next);
        }}
        onFocus={() => {
          if (disabled) return;
          setFocused(true);
          setDraft(value);
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          setOpen(false);
          if (!(draft.trim() || value.trim())) {
            onBlurEmpty?.();
          }
        }}
      />
      <button
        type="button"
        className="combo__toggle"
        aria-label={toggleLabel}
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => !disabled && setOpen((v) => !v)}
      />
      <ul id={listId} className="combo__list" role="listbox" hidden={!open}>
        {options.map((opt) => (
          <li key={opt}>
            <button
              type="button"
              role="option"
              aria-selected={opt === (focused ? draft : value)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDraft(opt);
                onChange(opt);
                setOpen(false);
                setFocused(false);
              }}
            >
              {opt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
