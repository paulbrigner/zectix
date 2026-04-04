"use client";

import { useId, useState } from "react";

export function EmbedHeightModeField({
  defaultHeight,
}: {
  defaultHeight: number;
}) {
  const [dynamic, setDynamic] = useState(true);
  const [height, setHeight] = useState(String(defaultHeight));
  const dynamicHintId = useId();
  const dynamicHelpText =
    "Dynamic automatically resizes the iframe to fit the calendar, event, or checkout step as visitors move through it.";

  return (
    <div className="console-field">
      <span className="console-field-label">
        <span className="console-field-label-row">
          <span>Iframe height</span>
        </span>
      </span>

      <div className="embed-height-mode">
        <label className="embed-height-toggle" htmlFor={dynamicHintId}>
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
          <span
            aria-label={dynamicHelpText}
            className="console-info-indicator"
            role="img"
            title={dynamicHelpText}
          >
            i
          </span>
        </label>
        <span className="console-field-help" id={`${dynamicHintId}-help`}>
          {dynamicHelpText}
        </span>

        <div className="console-input-with-unit">
          <input
            aria-describedby={`${dynamicHintId}-help`}
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
