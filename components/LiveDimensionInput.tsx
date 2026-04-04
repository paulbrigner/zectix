"use client";

import { useState } from "react";
import { useEmbedLiveTheme } from "@/components/EmbedLiveThemeProvider";

export function LiveDimensionInput({
  defaultValue,
  min,
  name,
  placeholder,
  themeKey,
}: {
  defaultValue: number | string;
  min?: number;
  name: string;
  placeholder?: string;
  themeKey?: string;
}) {
  const [value, setValue] = useState(String(defaultValue ?? ""));
  const liveTheme = useEmbedLiveTheme();

  function handleChange(next: string) {
    setValue(next);
    if (themeKey && liveTheme) {
      liveTheme.setOverride(
        themeKey as Parameters<typeof liveTheme.setOverride>[0],
        next,
      );
    }
  }

  return (
    <input
      className="console-input"
      min={min}
      name={name}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      type="number"
      value={value}
    />
  );
}
