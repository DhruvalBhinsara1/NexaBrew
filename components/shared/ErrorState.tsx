import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: Props): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-red-50 p-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div>
        <p className="font-semibold text-zinc-700">Error</p>
        <p className="mt-1 text-sm text-zinc-400">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-2">
          Try Again
        </Button>
      )}
    </div>
  );
}
