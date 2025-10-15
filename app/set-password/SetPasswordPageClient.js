"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Loading...");
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const access_token = searchParams.get("access_token");
    const refresh_token = searchParams.get("refresh_token");

    if (!access_token) {
      setMessage("Invalid or expired link.");
      return;
    }

    // ✅ Set the session from the invite/recovery link
    supabase.auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setMessage("Error restoring session: " + error.message);
        } else {
          setMessage("Session ready. Please set your new password below.");
          setSessionReady(true);
        }
      });
  }, [searchParams]);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage("Error updating password: " + error.message);
    } else {
      setMessage("✅ Password updated! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-200 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">Set Your Password</h1>
        <p className="text-center text-gray-400 mb-4">{message}</p>

        {sessionReady && (
          <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Enter new password"
              className="p-3 rounded bg-gray-700 border border-gray-600 text-gray-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded transition ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
