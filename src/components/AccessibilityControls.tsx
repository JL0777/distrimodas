"use client";

import { useEffect, useState } from "react";
import { Accessibility, AArrowDown, AArrowUp, Contrast, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type FontScale = "small" | "normal" | "large";

const FONT_SCALES: FontScale[] = ["small", "normal", "large"];
const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: "Pequeña",
  normal: "Normal",
  large: "Grande",
};

export function AccessibilityControls() {
  const [open, setOpen] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>("normal");
  const [boldContrast, setBoldContrast] = useState(false);

  useEffect(() => {
    const scale = localStorage.getItem("distrimodas-font-scale");
    const contrast = localStorage.getItem("distrimodas-bold-contrast");
    const safeScale = FONT_SCALES.includes(scale as FontScale) ? (scale as FontScale) : "normal";
    const safeContrast = contrast === "true";

    // Load persisted preferences after hydration to keep the server markup deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFontScale(safeScale);
    setBoldContrast(safeContrast);
    document.documentElement.dataset.fontScale = safeScale;
    document.documentElement.dataset.boldContrast = String(safeContrast);

    return () => {
      delete document.documentElement.dataset.fontScale;
      delete document.documentElement.dataset.boldContrast;
    };
  }, []);

  function changeFontScale(direction: -1 | 1) {
    const currentIndex = FONT_SCALES.indexOf(fontScale);
    const nextScale = FONT_SCALES[Math.max(0, Math.min(FONT_SCALES.length - 1, currentIndex + direction))];
    setFontScale(nextScale);
    localStorage.setItem("distrimodas-font-scale", nextScale);
    document.documentElement.dataset.fontScale = nextScale;
  }

  function toggleBoldContrast() {
    const nextValue = !boldContrast;
    setBoldContrast(nextValue);
    localStorage.setItem("distrimodas-bold-contrast", String(nextValue));
    document.documentElement.dataset.boldContrast = String(nextValue);
  }

  return (
    <div className="fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      {open && (
        <section
          aria-label="Opciones de accesibilidad"
          className="w-72 rounded-2xl border border-border bg-white p-4 shadow-[0_18px_55px_-20px_rgba(40,20,35,0.35)]"
        >
          <h2 className="text-sm font-bold">Accesibilidad</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ajusta la lectura según tu preferencia.</p>

          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">Tamaño de letra</p>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Disminuir tamaño de letra"
                  disabled={fontScale === "small"}
                  onClick={() => changeFontScale(-1)}
                >
                  <Minus className="size-4" />
                </Button>
                <span aria-live="polite" className="text-sm font-medium">
                  {FONT_SCALE_LABELS[fontScale]}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Aumentar tamaño de letra"
                  disabled={fontScale === "large"}
                  onClick={() => changeFontScale(1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="mt-2 flex justify-center gap-1 text-muted-foreground" aria-hidden="true">
                <AArrowDown className="size-4" />
                <span className="text-xs">A</span>
                <AArrowUp className="size-4" />
              </div>
            </div>

            <div className="border-t pt-3">
              <button
                type="button"
                aria-pressed={boldContrast}
                onClick={toggleBoldContrast}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Contrast className="size-4 text-primary" />
                  Texto más oscuro y marcado
                </span>
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    boldContrast ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                      boldContrast ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      <Button
        type="button"
        size="icon-lg"
        aria-label={open ? "Cerrar opciones de accesibilidad" : "Abrir opciones de accesibilidad"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="size-12 rounded-full border border-white/70 shadow-lg shadow-primary/20"
      >
        <Accessibility className="size-5" />
      </Button>
    </div>
  );
}
