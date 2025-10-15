"use client";

import dynamic from "next/dynamic";

// Dynamically import the client component to ensure no SSR
const SetPasswordPageClient = dynamic(
  () => import("./SetPasswordPageClient"),
  { ssr: false }
);

export default function Page() {
  return <SetPasswordPageClient />;
}
