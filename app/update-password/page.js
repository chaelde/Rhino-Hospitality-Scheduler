"use client";

import dynamic from "next/dynamic";

const UpdatePasswordPageClient = dynamic(() => import("./UpdatePasswordPageClient"), { ssr: false });

export default function Page() {
  return <UpdatePasswordPageClient />;
}
