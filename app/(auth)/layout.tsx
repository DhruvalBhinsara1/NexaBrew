import { Skiper71Wrapper } from "@/components/skiper/skiper71-wrapper";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <div className="flex min-h-screen bg-wise-canvas-soft">
      {/* Brand panel (hidden on mobile) */}
      <div className="hidden w-1/2 lg:block">
        <Skiper71Wrapper />
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
