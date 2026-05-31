"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ThemeOverrides = {
  accent_color?: string;
  background_color?: string;
  radius_px?: number;
  surface_color?: string;
  text_color?: string;
};

type EmbedLiveThemeContextValue = {
  liveThemeStyle: Record<string, string>;
  setOverride: (key: keyof ThemeOverrides, value: string) => void;
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

function parseHex(pair: string) {
  return parseInt(pair, 16);
}

function hexRgba(hex: string, alpha: number) {
  if (!HEX_RE.test(hex)) return hex;
  const r = parseHex(hex.slice(1, 3));
  const g = parseHex(hex.slice(3, 5));
  const b = parseHex(hex.slice(5, 7));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildLiveStyle(overrides: ThemeOverrides): Record<string, string> {
  const style: Record<string, string> = {};

  if (overrides.accent_color && HEX_RE.test(overrides.accent_color)) {
    const c = overrides.accent_color;
    style["--accent"] = c;
    style["--accent-hover"] = c;
    style["--accent-bright"] = c;
    style["--accent-text"] = c;
    style["--accent-subtle"] = hexRgba(c, 0.12);
    style["--accent-glow"] = hexRgba(c, 0.24);
    style["--accent-border"] = hexRgba(c, 0.28);
  }

  if (overrides.background_color && HEX_RE.test(overrides.background_color)) {
    style["--surface-page"] = overrides.background_color;
  }

  if (overrides.surface_color && HEX_RE.test(overrides.surface_color)) {
    style["--surface-card"] = overrides.surface_color;
    style["--surface-card-glass"] = overrides.surface_color;
    style["--surface-card-solid"] = overrides.surface_color;
    style["--surface-elevated"] = overrides.surface_color;
  }

  if (overrides.text_color && HEX_RE.test(overrides.text_color)) {
    style["--text-dark"] = overrides.text_color;
    style["--color-gray-900"] = overrides.text_color;
  }

  if (overrides.radius_px != null) {
    const r = overrides.radius_px;
    style["--radius-lg"] = `${Math.max(10, r - 4)}px`;
    style["--radius-xl"] = `${r}px`;
    style["--radius-2xl"] = `${Math.max(r + 2, r)}px`;
    style["--radius-3xl"] = `${Math.max(r + 6, r)}px`;
  }

  return style;
}

const EmbedLiveThemeContext =
  createContext<EmbedLiveThemeContextValue | null>(null);

export function EmbedLiveThemeProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<ThemeOverrides>({});

  const setOverride = useCallback(
    (key: keyof ThemeOverrides, value: string) => {
      setOverrides((prev) => {
        if (key === "radius_px") {
          const parsed = parseInt(value, 10);
          return { ...prev, radius_px: Number.isFinite(parsed) ? parsed : undefined };
        }
        return { ...prev, [key]: value || undefined };
      });
    },
    [],
  );

  const liveThemeStyle = useMemo(() => buildLiveStyle(overrides), [overrides]);

  return (
    <EmbedLiveThemeContext.Provider value={{ liveThemeStyle, setOverride }}>
      {children}
    </EmbedLiveThemeContext.Provider>
  );
}

export function useEmbedLiveTheme() {
  return useContext(EmbedLiveThemeContext);
}
