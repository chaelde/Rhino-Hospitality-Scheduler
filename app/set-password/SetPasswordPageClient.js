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

  // ✅ Get tokens directly from URL (from the invite email)
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  // Step 1: Establish Supabase session immediately
  useEffect(() => {
    const initSession = async () => {
      if (!accessToken || !refreshToken) {
        setMessage("Missing or invalid access token.");
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) throw error;

        if (data.session) {
          setSessionReady(true);
          setMessage("Session verified. You can now set your password.");
        } else {
          throw new Error("No session returned from Supabase.");
        }
      } catch (err) {
        console.error("Session error:", err);
        setMessage("Error establishing session: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [accessToken, refreshToken]);

  // Step 2: Handle password update
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

      setMessage("Password updated successfully! Redirecting to login...");
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
        <h1 className="text-2xl font-bold text-white mb-4 text-center">
          Set Your Password
        </h1>

        {message && (
          <p className="text-yellow-400 text-center mb-4">{message}</p>
        )}

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
