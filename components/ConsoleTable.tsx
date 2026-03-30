import type { ComponentPropsWithoutRef, ReactNode } from "react";

function joinClasses(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export function ConsoleTable({
  children,
  className,
  tableClassName,
}: {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
}) {
  return (
    <div className={joinClasses("console-table-wrap", className)}>
      <table className={joinClasses("console-table", tableClassName)}>
        {children}
      </table>
    </div>
  );
}

export function ConsoleTableHead(props: ComponentPropsWithoutRef<"thead">) {
  return <thead {...props} />;
}

export function ConsoleTableBody(props: ComponentPropsWithoutRef<"tbody">) {
  return <tbody {...props} />;
}

export function ConsoleTableRow(props: ComponentPropsWithoutRef<"tr">) {
  return <tr {...props} />;
}

export function ConsoleTableHeader(props: ComponentPropsWithoutRef<"th">) {
  return <th {...props} />;
}

export function ConsoleTableCell(props: ComponentPropsWithoutRef<"td">) {
  return <td {...props} />;
}
