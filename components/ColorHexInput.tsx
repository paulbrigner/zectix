"use client";

import { useState } from "react";
import { useEmbedLiveTheme } from "@/components/EmbedLiveThemeProvider";

const HEX_6_RE = /^#[0-9a-f]{6}$/i;

export function ColorHexInput({
  defaultValue,
  name,
  placeholder,
  themeKey,
}: {
  defaultValue: string;
  name: string;
  placeholder: string;
  themeKey?: string;
}) {
  const [value, setValue] = useState(defaultValue || "");
  const displayColor = HEX_6_RE.test(value) ? value : placeholder;
  const liveTheme = useEmbedLiveTheme();

  function handleChange(next: string) {
    setValue(next);
    if (themeKey && liveTheme) {
      liveTheme.setOverride(themeKey as Parameters<typeof liveTheme.setOverride>[0], next);
    }
  }

  return (
    <div className="console-color-input">
      <input
        className="console-input"
        name={name}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
      <input
        aria-label="Pick color"
        className="console-color-swatch"
        onChange={(e) => handleChange(e.target.value)}
        type="color"
        value={displayColor}
      />
    </div>
  );
}
