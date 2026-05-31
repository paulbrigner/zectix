export function ConsoleFieldLabel({
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
    </span>
  );
}

export function ConsoleFieldHint({ children }: { children: React.ReactNode }) {
  return <span className="console-field-help">{children}</span>;
}
