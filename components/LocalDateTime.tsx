"use client";

export function LocalDateTime({ iso }: { iso: string }) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return <>{iso}</>;
  }

  return (
    <time dateTime={iso}>
      {date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
    </time>
  );
}

