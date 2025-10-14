"use client";

import "./globals.css";
import NavBar from "@/components/NavBar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }) {
  const [user, setUser] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    let subscription;

    const initAuth = async () => {
      try {
        // Get current session once
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // Subscribe to auth changes
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });
        subscription = data.subscription;
      } catch (err) {
        console.error("Error initializing auth:", err);
      }
    };

    initAuth();

    // ✅ Proper cleanup
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Hide navbar and any auth wrappers for login/signed-out routes
  const hideNav = ["/login", "/signed-out"].includes(pathname);

  // ✅ Prevent flicker by not rendering anything until user is known
  // (This avoids the white "Login" box from a premature mount)
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
