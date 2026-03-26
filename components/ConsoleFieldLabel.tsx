export function ConsoleFieldLabel({
  info,
  label,
  optional = false,
}: {
  info?: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <span className="console-field-label">
      <span className="console-field-label-row">
        <span>{label}</span>
        <span className="console-field-meta">
          {optional ? <span className="console-field-badge">Optional</span> : null}
        </span>
      </span>
      {info ? (
        <span className="console-field-help">
          <span aria-hidden="true" className="console-info-indicator">
            i
          </span>
          <span>{info}</span>
        </span>
      ) : null}
    </span>
  );
}
