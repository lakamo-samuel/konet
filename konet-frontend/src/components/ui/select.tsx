"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option = { value: string; label: string; disabled?: boolean };
type Props = {
  options: Option[];
  name?: string;
  id?: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function Select({ options, name, id, label, defaultValue, placeholder, required, className = "" }: Props) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const listId = `${buttonId}-options`;
  const root = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [value, setValue] = useState(defaultValue ?? options.find(option => !option.disabled)?.value ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  useEffect(() => {
    if (open) optionRefs.current[active]?.focus();
  }, [open, active]);
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
  const initialActive = () => {
    const selectedIndex = options.findIndex(option => option.value === value && !option.disabled);
    return selectedIndex >= 0 ? selectedIndex : (enabled[0] ?? 0);
  };
  const move = (direction: number) => {
    const current = enabled.indexOf(active);
    setActive(enabled[(current + direction + enabled.length) % enabled.length] ?? 0);
  };
  const choose = (option: Option) => {
    if (option.disabled) return;
    setValue(option.value);
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
  };
  return <div ref={root} className={`relative min-w-0 ${className}`}>
    {name && <input type="hidden" name={name} value={value} />}
    <button id={buttonId} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} data-required={required || undefined}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-left text-sm text-[var(--ink)] transition-colors hover:border-[var(--clay)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay)]"
      onClick={() => { setActive(initialActive()); setOpen(!open); }}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(initialActive()); setOpen(true); } }}>
      <span className="truncate">{selected?.label ?? placeholder ?? "Select an option"}</span><ChevronDown aria-hidden size={16} className={`shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div id={listId} role="listbox" aria-label={label} className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-64 w-full min-w-48 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl shadow-black/10"
      onKeyDown={event => { if (event.key === "Escape" || event.key === "Tab") { setOpen(false); if (event.key === "Escape") root.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus(); } else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); } else if (event.key === "Home" || event.key === "End") { event.preventDefault(); setActive(event.key === "Home" ? enabled[0] : enabled[enabled.length - 1]); } else if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) { const match = options.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(event.key.toLowerCase())); if (match >= 0) setActive(match); } }}>
      {options.map((option, index) => <button key={`${option.value}-${index}`} ref={element => { optionRefs.current[index] = element; }} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} tabIndex={index === active ? 0 : -1} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--canvas)] focus:bg-[var(--canvas)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
        <span>{option.label}</span>{option.value === value && <Check aria-hidden size={16} className="shrink-0 text-[var(--clay)]" />}
      </button>)}
    </div>}
  </div>;
}
