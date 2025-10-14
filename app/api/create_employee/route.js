"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    try {
      const tokenParam = searchParams.get("access_token");
      const emailParam = searchParams.get("email");

      if (!tokenParam || !emailParam) {
        setError("Invalid or missing invite link.");
        return;
      }

      // Decode in case URL encoding caused issues
      setAccessToken(decodeURIComponent(tokenParam));
      setEmail(decodeURIComponent(emailParam));
    } catch (err) {
      console.error("Error parsing URL params:", err);
      setError("Invalid invite link format.");
    }
  }, [searchParams]);

  const validatePassword = (pw) => {
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;
    return regex.test(pw);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validatePassword(password)) {
      setError(
        "Password must be at least 8 characters and include lowercase, uppercase, number, and special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!accessToken) {
      setError("Missing access token.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        access_token: accessToken,
        password,
      });

      if (error) {
        console.error("Error updating password:", error);
        setError(error.message);
      } else {
        setSuccess("Password successfully set! You can now log in.");
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Unexpected error setting password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-200 p-4">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Set Your Password</h1>
        <p className="mb-4 text-gray-400">
          Please create a password for your account. Requirements:
        </p>
        <ul className="list-disc list-inside mb-4 text-gray-300">
          <li>At least 8 characters</li>
          <li>At least 1 lowercase letter</li>
          <li>At least 1 uppercase letter</li>
          <li>At least 1 number</li>
          <li>At least 1 special character</li>
        </ul>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-gray-200 border border-gray-600"
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-gray-200 border border-gray-600"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded font-semibold ${
              loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {loading ? "Setting password..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
