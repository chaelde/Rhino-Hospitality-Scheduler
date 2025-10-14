"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function EmployeeProfileForm({ employee, setEmployee, editable = false }) {
  const [formData, setFormData] = useState({ ...employee });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData({ ...employee });
  }, [employee]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error, data } = await supabase
        .from("employees")
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        })
        .eq("id", employee.id)
        .select()
        .single();

      if (error) {
        alert("Error updating profile: " + error.message);
        return;
      }

      setEmployee(data);
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Update error:", err);
      alert("Unexpected error updating profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-900 text-gray-200 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Employee Profile</h2>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col">
          <span className="mb-1 font-medium">Name</span>
          <input
            type="text"
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            disabled={!editable || loading}
            className="border border-gray-700 rounded px-3 py-2 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>

        <label className="flex flex-col">
          <span className="mb-1 font-medium">Email</span>
          <input
            type="email"
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            disabled={!editable || loading}
            className="border border-gray-700 rounded px-3 py-2 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>

        <label className="flex flex-col">
          <span className="mb-1 font-medium">Phone</span>
          <input
            type="text"
            name="phone"
            value={formData.phone || ""}
            onChange={handleChange}
            disabled={!editable || loading}
            className="border border-gray-700 rounded px-3 py-2 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>

        {editable && (
          <button
            onClick={handleSave}
            disabled={loading}
            className={`mt-4 px-4 py-2 rounded-lg font-semibold ${
              loading ? "bg-gray-600 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}
