import type { ReactNode } from "react";

export default function MenuLayout({ children }: { children: ReactNode }): React.ReactElement {
  return <div className="min-h-screen bg-wise-canvas-soft">{children}</div>;
}
