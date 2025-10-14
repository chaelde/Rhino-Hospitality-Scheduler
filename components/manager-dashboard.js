"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

export default function ManagerDashboard() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [employeeNotes, setEmployeeNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const router = useRouter();

  // --- Session & role check ---
  useEffect(() => {
    const fetchSessionAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      setSession(session);

      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("role")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (empError || !empData) {
        alert("Employee not found. Please contact admin.");
        router.push("/");
        return;
      }

      setUserRole(empData.role);

      if (!["Manager", "Admin"].includes(empData.role)) {
        router.push("/home");
        return;
      }

      await loadPendingRequests();
      await loadEmployeeNotes();
    };

    fetchSessionAndRole();
  }, [router]);

  // --- Load pending requests ---
  const loadPendingRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select(`
          id,
          employee_auth_id,
          start_date,
          end_date,
          reason,
          status,
          employees (id,name)
        `)
        .eq("status", "pending")
        .order("start_date", { ascending: true });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (err) {
      console.error("Error fetching pending requests:", err);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Load employee notes ---
  const loadEmployeeNotes = async () => {
    try {
      const { data, error } = await supabase.from("employee_notes").select("*");
      if (error) throw error;
      const notesMap = {};
      (data || []).forEach((n) => {
        notesMap[n.employee_id] = n.note;
      });
      setEmployeeNotes(notesMap);
    } catch (err) {
      console.error("Error fetching employee notes:", err);
    }
  };

  // --- Approve / Deny ---
  const handleDecision = async (requestId, decision) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      const { error } = await supabase
        .from("time_off_requests")
        .update({ status: decision })
        .eq("id", requestId);

      if (error) throw error;
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      alert("Error updating request: " + err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  // --- Handle notes change ---
  const handleNoteChange = (empId, newNote) => {
    setEmployeeNotes((prev) => ({ ...prev, [empId]: newNote }));
  };

  const saveNote = async (empId) => {
    try {
      const existingNote = employeeNotes[empId];
      const { error } = await supabase
        .from("employee_notes")
        .upsert({ employee_id: empId, note: existingNote }, { onConflict: "employee_id" });

      if (error) throw error;
      alert("Note saved!");
    } catch (err) {
      alert("Error saving note: " + err.message);
    }
  };

  if (loading) return <p className="p-6 text-gray-200">Loading pending requests...</p>;

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-200">
      <h1 className="text-3xl font-bold mb-6">Manager Dashboard</h1>

      {pendingRequests.length === 0 ? (
        <p className="text-gray-400">No pending time-off requests at this time.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-lg bg-gray-800">
          <table className="w-full border-collapse text-gray-200">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-3 border border-gray-600 text-left">Employee</th>
                <th className="p-3 border border-gray-600 text-left">Start Date</th>
                <th className="p-3 border border-gray-600 text-left">End Date</th>
                <th className="p-3 border border-gray-600 text-left">Reason</th>
                <th className="p-3 border border-gray-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-700">
                  <td className="p-3 border border-gray-600 relative group">
                    <span className="cursor-pointer underline">
                      {req.employees?.name || "Unknown"}
                    </span>
                    <div className="absolute left-0 top-full mt-1 w-64 p-3 bg-gray-800 border border-gray-600 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      <textarea
                        value={employeeNotes[req.employees?.id] || ""}
                        onChange={(e) =>
                          handleNoteChange(req.employees?.id, e.target.value)
                        }
                        placeholder="Add/edit notes..."
                        className="w-full p-2 rounded bg-gray-700 text-gray-200 border border-gray-600"
                      />
                      <button
                        onClick={() => saveNote(req.employees?.id)}
                        className="mt-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td className="p-3 border border-gray-600">{format(new Date(req.start_date), "MM/dd/yyyy")}</td>
                  <td className="p-3 border border-gray-600">{format(new Date(req.end_date), "MM/dd/yyyy")}</td>
                  <td className="p-3 border border-gray-600">{req.reason || "-"}</td>
                  <td className="p-3 border border-gray-600 flex gap-2 justify-center">
                    <button
                      onClick={() => handleDecision(req.id, "approved")}
                      disabled={actionLoading[req.id]}
                      className={`px-3 py-1 rounded font-semibold text-white ${
                        actionLoading[req.id] ? "bg-gray-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
                      }`}
                    >
                      {actionLoading[req.id] ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, "denied")}
                      disabled={actionLoading[req.id]}
                      className={`px-3 py-1 rounded font-semibold text-white ${
                        actionLoading[req.id] ? "bg-gray-500 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                      }`}
                    >
                      {actionLoading[req.id] ? "Processing..." : "Deny"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
