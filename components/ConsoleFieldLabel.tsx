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
      <span>{label}</span>
      <span className="console-field-meta">
        {optional ? <span className="console-field-badge">Optional</span> : null}
        {info ? (
          <span
            aria-label={info}
            className="console-info-indicator"
            role="img"
            tabIndex={0}
            title={info}
          >
            i
          </span>
        ) : null}
      </span>
    </span>
  );
}
