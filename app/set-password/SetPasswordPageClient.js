"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return setMessage("Missing token.");

    const verifyToken = async () => {
      try {
        const res = await fetch("/api/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);

        const { access_token, refresh_token } = result.data.session;
        await supabase.auth.setSession({ access_token, refresh_token });
        setSessionReady(true);
        setMessage("Session verified. Set your password.");
      } catch (err) {
        setMessage("Error verifying token: " + err.message);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return setMessage("Passwords do not match.");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password updated! Redirecting...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setMessage("Error updating password: " + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="p-8 bg-gray-800 rounded-xl">
        <h1 className="text-white text-center text-2xl mb-4">Set Your Password</h1>
        <p className="text-yellow-400 text-center mb-4">{message}</p>
        {sessionReady && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-3 rounded bg-gray-700 text-white"
              required
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="p-3 rounded bg-gray-700 text-white"
              required
            />
            <button type="submit" className="bg-blue-600 py-3 rounded text-white">
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
