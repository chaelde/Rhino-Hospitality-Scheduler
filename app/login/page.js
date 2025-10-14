// app/login/page.js
"use client";

import dynamic from "next/dynamic";

const LoginPageClient = dynamic(() => import("./LoginPageClient"), { ssr: false });

export default function LoginPage() {
  return <LoginPageClient />;
}
