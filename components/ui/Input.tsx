import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  info?: string;
  error?: string;
  optional?: boolean;
};

export function Input({
  label,
  info,
  error,
  optional = false,
  className,
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <label className="console-field" htmlFor={inputId}>
      {label && (
        <span className="console-field-label">
          <span className="console-field-label-row">
            <span>{label}</span>
            {optional && (
              <span className="console-field-meta">
                <span className="console-field-badge">Optional</span>
              </span>
            )}
          </span>
          {info && (
            <span className="console-field-help">
              <span aria-hidden="true" className="console-info-indicator">
                i
              </span>
              <span>{info}</span>
            </span>
          )}
        </span>
      )}
      <input
        id={inputId}
        className={["console-input", className ?? ""].filter(Boolean).join(" ")}
        {...rest}
      />
      {error && <span className="console-error-text">{error}</span>}
    </label>
  );
}
