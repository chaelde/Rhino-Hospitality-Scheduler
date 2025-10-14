"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UpdatePasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const accessToken = searchParams.get("access_token"); // Supabase sends this in reset link

  useEffect(() => {
    if (!accessToken) {
      setMessage("Invalid or missing password reset token.");
    }
  }, [accessToken]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!accessToken) {
      setMessage("Missing token. Cannot update password.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      }, accessToken);

      if (error) throw error;

      setMessage("Password updated successfully! Redirecting to login...");
      setTimeout(() => router.replace("/login"), 3000);
    } catch (err) {
      setMessage(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
        <h1 className="text-2xl font-bold text-center text-white mb-6">Set a New Password</h1>

        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-gray-700 border border-gray-600 p-3 rounded text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-gray-700 border border-gray-600 p-3 rounded text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded transition-colors"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        {message && <p className="mt-4 text-center text-yellow-400">{message}</p>}
      </div>
    </div>
  );
}
