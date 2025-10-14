"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useRouter } from "next/navigation";

export default function useAuthRedirect() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      // Fetch employee role
      const { data: empData, error } = await supabase
        .from("employees")
        .select("role")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error || !empData) {
        router.replace("/login");
        return;
      }

      const role = empData.role;

      // Redirect based on role
      if (["Manager", "Admin"].includes(role)) {
        router.replace("/manager-dashboard");
      } else {
        router.replace("/home");
      }

      setLoading(false);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) router.replace("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  return loading;
}
