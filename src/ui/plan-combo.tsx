"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  id: string;
  name: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  toggleLabel: string;
};

export function PlanCombo({
  id,
  name,
  value,
  options,
  onChange,
  placeholder,
  toggleLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

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
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      <button
        type="button"
        className="combo__toggle"
        aria-label={toggleLabel}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      />
      <ul id={listId} className="combo__list" role="listbox" hidden={!open}>
        {options.map((opt) => (
          <li key={opt}>
            <button
              type="button"
              role="option"
              aria-selected={opt === value}
              onClick={() => {
                onChange(opt);
                setOpen(false);
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
