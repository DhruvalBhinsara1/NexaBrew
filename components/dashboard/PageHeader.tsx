import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: Props): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-wise-border pb-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-wise-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-wise-body">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
