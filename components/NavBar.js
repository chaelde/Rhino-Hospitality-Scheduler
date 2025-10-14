"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiMenu, HiX } from "react-icons/hi"; // Hamburger/X icons

export default function NavBar({ user }) {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function fetchRole() {
      const { data, error } = await supabase
        .from("employees")
        .select("role")
        .eq("auth_id", user.id)
        .single();

      if (error) console.error("Error fetching role:", error);
      setRole(data?.role || null);
    }

    fetchRole();
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/signed-out");
  };

  return (
    <nav className="bg-gray-800 p-4 shadow-md">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="text-white font-bold text-lg">
          Rhino Hospitality Group
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link href="/home" className="font-bold hover:text-blue-400 transition">
                Dashboard
              </Link>
              <Link href="/schedule" className="font-bold hover:text-blue-400 transition">
                Schedule
              </Link>
              {(role === "Manager" || role === "Admin") && (
                <Link href="/employees" className="font-bold hover:text-blue-400 transition">
                  Employees
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/login" className="font-bold hover:text-blue-400 transition">
              Log In
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        {user && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white text-2xl focus:outline-none"
          >
            {menuOpen ? <HiX /> : <HiMenu />}
          </button>
        )}
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden mt-2 flex flex-col gap-2 bg-gray-700 p-2 rounded">
          <Link
            href="/home"
            onClick={() => setMenuOpen(false)}
            className="font-bold hover:text-blue-400 transition"
          >
            Dashboard
          </Link>
          <Link
            href="/schedule"
            onClick={() => setMenuOpen(false)}
            className="font-bold hover:text-blue-400 transition"
          >
            Schedule
          </Link>
          {(role === "Manager" || role === "Admin") && (
            <Link
              href="/employees"
              onClick={() => setMenuOpen(false)}
              className="font-bold hover:text-blue-400 transition"
            >
              Employees
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
