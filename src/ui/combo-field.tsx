"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type ComboOption = {
  value: string;
  label: string;
};

type ComboFieldProps = {
  id: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder: string;
  label: ReactNode;
  filterOptions?: (options: ComboOption[], query: string) => ComboOption[];
  listAriaLabel: string;
  toggleAriaLabel: string;
};

export function ComboField({
  id,
  testId,
  value,
  onChange,
  options,
  placeholder,
  label,
  filterOptions,
  listAriaLabel,
  toggleAriaLabel,
}: ComboFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    if (filterOptions) return filterOptions(options, query);
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [filterOptions, options, query]);

  useEffect(() => {
    if (!mounted || focused) return;
    setQuery(selected?.label ?? "");
  }, [mounted, focused, selected?.label]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  const commitSelection = useCallback(
    (option: ComboOption | undefined) => {
      if (!option) return;
      onChange(option.value);
      setQuery(option.label);
      setOpen(false);
      setFocused(false);
      inputRef.current?.blur();
    },
    [onChange],
  );

  function openList() {
    setOpen(true);
    setActiveIndex(0);
  }

  function onInputChange(next: string) {
    setQuery(next);
    setOpen(true);
    if (!next.trim()) onChange("");
  }

  function onInputFocus() {
    setFocused(true);
    openList();
  }

  function onInputBlur() {
    setFocused(false);
    window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      setOpen(false);
      const trimmed = query.trim();
      if (!trimmed) {
        onChange("");
        setQuery("");
        return;
      }
      const exact = options.find((o) => o.label === trimmed || o.value === trimmed.toUpperCase());
      if (exact) {
        onChange(exact.value);
        setQuery(exact.label);
        return;
      }
      setQuery(selected?.label ?? "");
    }, 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      else setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        commitSelection(filtered[activeIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery(selected?.label ?? "");
      inputRef.current?.blur();
    }
  }

  const activeId =
    mounted && open && filtered[activeIndex]
      ? `${listId}-opt-${filtered[activeIndex].value}`
      : undefined;

  const showList = mounted && open && filtered.length > 0;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div
        ref={rootRef}
        className={`combo${open ? " is-open" : ""}`}
        data-testid={testId}
        data-value={value || undefined}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList ? activeId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onKeyDown={onKeyDown}
          data-testid={`${testId}-input`}
        />
        <button
          type="button"
          className="combo__toggle"
          aria-label={toggleAriaLabel}
          aria-expanded={showList}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!mounted) return;
            if (open) {
              setOpen(false);
              inputRef.current?.blur();
            } else {
              inputRef.current?.focus();
              openList();
            }
          }}
          data-testid={`${testId}-toggle`}
        />
        {showList ? (
          <ul
            id={listId}
            className="combo__list"
            role="listbox"
            aria-label={listAriaLabel}
          >
            {filtered.map((option, index) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  id={`${listId}-opt-${option.value}`}
                  role="option"
                  aria-selected={value === option.value}
                  data-testid={`${testId}-option`}
                  data-value={option.value}
                  data-active={index === activeIndex ? "true" : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitSelection(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
