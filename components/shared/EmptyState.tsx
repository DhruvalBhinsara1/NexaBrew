import type { LucideIcon } from "lucide-react";
import { InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  subtitle,
  action,
}: Props): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-surface-muted p-4">
        <Icon className="h-8 w-8 text-zinc-300" />
      </div>
      <div>
        <p className="font-semibold text-zinc-700">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
