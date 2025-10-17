"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPageClient() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const TEMP_PASSWORD = "TempRHGpass!"; // temporary password assigned to new users

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Fetch employee data
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("role, must_change_password")
        .eq("auth_id", data.user.id)
        .maybeSingle();

      if (empError) throw empError;

      // Force password change if using temp password or must_change_password flag
      if (password === TEMP_PASSWORD || empData?.must_change_password) {
        router.replace(`/force-change-password?user_id=${data.user.id}`);
        return;
      }

      // Redirect based on role
      if (["Manager", "Admin"].includes(empData?.role)) {
        router.replace("/manager-dashboard");
      } else {
        router.replace("/home");
      }
    } catch (err) {
      setMessage("Login failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage("Please enter your email first.");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/force-change-password`,
      });
      if (error) throw error;
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setMessage("Failed to send reset email: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
        <h1 className="text-3xl font-bold text-center text-white mb-6">
          Welcome to Rhino Hospitality Group
        </h1>

        {message && <p className="text-center text-yellow-400 mb-4">{message}</p>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-700 border border-gray-600 p-3 rounded text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-700 border border-gray-600 p-3 rounded text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className={`bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded transition-colors ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <button
          onClick={handleForgotPassword}
          disabled={loading}
          className="mt-4 text-sm text-blue-400 hover:underline self-start"
        >
          Forgot Password?
        </button>
      </div>
    </div>
  );
}
