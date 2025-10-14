"use client";

import "./globals.css";
import NavBar from "@/components/NavBar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let subscription;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setUser(session?.user ?? null);
        setLoading(false);

        // Subscribe to auth changes
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });
        subscription = data.subscription;
      } catch (err) {
        console.error("Error initializing auth:", err);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const hideNav = ["/login", "/signed-out"].includes(pathname);

  // Only show loading indicator if auth is loading AND the page expects a user
  if (loading && !hideNav) {
    return (
      <html lang="en">
        <body className="bg-gray-900 text-gray-200 min-h-screen flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-gray-900 text-gray-200 min-h-screen">
        {!hideNav && <NavBar user={user} />}
        <main>{children}</main>
      </body>
    </html>
  );
}
