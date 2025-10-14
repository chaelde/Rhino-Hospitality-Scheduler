"use client";

import Link from "next/link";

export default function SignedOutPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-200">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700 text-center">
        <h1 className="text-3xl font-bold mb-4">You have been signed out</h1>
        <p className="mb-6">You are now safely signed out of the system.</p>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded font-semibold transition"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
