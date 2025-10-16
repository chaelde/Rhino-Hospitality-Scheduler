"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const exchangeSession = async () => {
      const code = searchParams.get("code");
      if (!code) {
        console.error("No code found in URL");
        return router.replace("/login");
      }

      try {
        // Exchange the code for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Failed to verify session:", error.message);
          alert("Failed to verify session: " + error.message);
          return router.replace("/login");
        }

        console.log("✅ Session established:", data.session);
        router.replace("/set-password");
      } catch (err) {
        console.error("Unexpected error:", err);
        router.replace("/login");
      }
    };

    exchangeSession();
  }, [router, searchParams]);

  return (
    <div className="text-white p-6">
      <p>Verifying your session...</p>
    </div>
  );
}
