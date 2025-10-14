"use client";

import "./globals.css";
import NavBar from "@/components/NavBar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }) {
  const [user, setUser] = useState(undefined); // undefined means "loading"
  const pathname = usePathname();

  useEffect(() => {
    let subscription;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });
        subscription = data.subscription;
      } catch (err) {
        console.error("Error initializing auth:", err);
        setUser(null);
      }
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const hideNav = ["/login", "/signed-out"].includes(pathname);

  // Render a loading placeholder until auth is resolved
  if (user === undefined) {
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
