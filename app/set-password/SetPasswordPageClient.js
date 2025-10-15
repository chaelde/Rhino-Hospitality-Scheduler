"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Loading...");
  const [sessionReady, setSessionReady] = useState(false);

  // ✅ Step 1: Handle token from the magic link
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      setMessage("Invalid or expired reset link.");
      return;
    }

    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      setMessage("Missing authentication tokens.");
      return;
    }

    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ data, error }) => {
        if (error) {
          setMessage("Error establishing session: " + error.message);
        } else {
          setSessionReady(true);
          setMessage("Session established. Set your new password below.");
        }
      });
  }, []);

  // ✅ Step 2: Allow password update once session is set
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Error updating password: " + error.message);
    } else {
      setMessage("Password updated successfully! Redirecting...");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-100">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4 text-center">Set Your Password</h1>
        <p className="text-center text-sm text-gray-400 mb-4">{message}</p>

        {sessionReady && (
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <input
              type="password"
              placeholder="Enter new password"
              className="w-full p-3 rounded bg-gray-700 text-gray-200 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-500 p-3 rounded font-semibold"
            >
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
