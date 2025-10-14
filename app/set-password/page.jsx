"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Step 1️⃣: Handle the magic link token in the URL
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      setMessage("Invalid or expired link.");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(hash.replace("#", ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      setMessage("Missing authentication tokens.");
      setLoading(false);
      return;
    }

    // ✅ Exchange token for session
    supabase.auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) setMessage("Error establishing session: " + error.message);
        else setMessage("Session established. Please set your password below.");
        setLoading(false);
      });
  }, []);

  // Step 2️⃣: Handle password update
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Error updating password: " + error.message);
    } else {
      setMessage("Password updated successfully! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  if (loading) return <p className="p-6 text-gray-200">Loading...</p>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-100">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4 text-center">Set Your Password</h1>
        <p className="mb-4 text-sm text-gray-400 text-center">{message}</p>

        {message.includes("Session established") && (
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <input
              type="password"
              placeholder="Enter new password"
              className="w-full p-2 rounded bg-gray-700 text-gray-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-500 p-2 rounded font-semibold"
            >
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
