"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PresetDropdownOption } from "./calculateFormModel";
import { FORM_CONTROL_DISABLED } from "./formStyles";

export function PresetDropdown<T extends number | string>({
  id,
  value,
  options,
  onChange,
  placeholder = "—",
  hasError = false,
  describedBy,
}: {
  id?: string;
  value: T | "";
  options: ReadonlyArray<PresetDropdownOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
  hasError?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const selected = options.find((opt) => opt.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const borderClass = open
    ? "border-accent"
    : hasError
      ? "border-danger"
      : "border-field-border focus:border-accent";

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={describedBy}
        onClick={() => setOpen((prev) => !prev)}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        className={`flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-sm border bg-field px-3 py-1.5 text-left text-ink transition-colors lg:h-9 ${FORM_CONTROL_DISABLED} ${borderClass}`}
      >
        <span className="min-w-0 whitespace-normal break-words">{displayLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          style={
            menuBox
              ? {
                  position: "fixed",
                  top: menuBox.top,
                  left: menuBox.left,
                  width: menuBox.width,
                }
              : undefined
          }
          className="z-50 max-h-60 overflow-y-auto rounded-sm border border-line bg-surface py-1 shadow-sm [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-surface [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb:hover]:bg-line-strong"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={String(opt.value)} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-accent-soft font-medium text-accent-text"
                      : "text-ink hover:bg-surface-muted"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {opt.label}
                    {opt.description ? (
                      <span className="font-normal text-ink-muted">{` — ${opt.description}`}</span>
                    ) : null}
                  </span>
                  {isSelected && (
                    <svg
                      className="h-4 w-4 shrink-0 text-accent-text"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
