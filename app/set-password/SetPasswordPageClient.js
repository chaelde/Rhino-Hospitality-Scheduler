"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const token = searchParams.get("token");

  // Step 1: Verify token on mount
  useEffect(() => {
    if (!token) {
      setMessage("Missing or invalid token.");
      return;
    }

    const verifyToken = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error || "Invalid token");

        const { access_token, refresh_token } = result.data.session;
        await supabase.auth.setSession({ access_token, refresh_token });

        setSessionReady(true);
        setMessage("Session verified. Please set your password.");
      } catch (err) {
        console.error("verifyToken error:", err);
        setMessage("Failed to verify session: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  // Step 2: Submit new password
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMessage("Password updated! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setMessage("Error updating password: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-4 text-center">Set Your Password</h1>
        {message && <p className="text-yellow-400 text-center mb-4">{message}</p>}

        {sessionReady && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-3 rounded bg-gray-700 text-gray-200 border border-gray-600"
              required
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="p-3 rounded bg-gray-700 text-gray-200 border border-gray-600"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
