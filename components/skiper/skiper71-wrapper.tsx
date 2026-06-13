"use client";

import dynamic from "next/dynamic";

const Skiper71 = dynamic(
  () =>
    import("@/components/skiper/skiper71").then((m) => ({
      default: m.Skiper71,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-full bg-zinc-950" />
    ),
  }
);

export function Skiper71Wrapper(): React.ReactElement {
  return <Skiper71 />;
}
