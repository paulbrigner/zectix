"use client";

import { useId, useState } from "react";

export function EmbedHeightModeField({
  defaultDynamic,
  defaultHeight,
}: {
  defaultDynamic: boolean;
  defaultHeight: number;
}) {
  const [dynamic, setDynamic] = useState(defaultDynamic);
  const [height, setHeight] = useState(String(defaultHeight));
  const dynamicHintId = useId();

  return (
    <div className="console-field">
      <span className="console-field-label">
        <span className="console-field-label-row">
          <span>Iframe height</span>
        </span>
      </span>

      <div className="embed-height-mode">
        <div className="embed-height-toggle">
          <label className="embed-height-toggle-label" htmlFor={dynamicHintId}>
            <input
              checked={dynamic}
              id={dynamicHintId}
              name="embed_dynamic_height"
              onChange={(event) => {
                const nextChecked = event.target.checked;
                setDynamic(nextChecked);
                if (!height.trim()) {
                  setHeight(String(defaultHeight));
                }
              }}
              type="checkbox"
            />
            <span>Dynamic</span>
          </label>
        </div>

        <div className="console-input-with-unit">
          <input
            className="console-input"
            data-embed-height-visible="true"
            disabled={dynamic}
            min={480}
            onChange={(event) => setHeight(event.target.value)}
            type="number"
            value={height}
          />
          <span className="console-input-unit">px</span>
        </div>

        <input
          name="embed_default_height_px"
          type="hidden"
          value={height || String(defaultHeight)}
        />
      </div>
    </div>
  );
}
