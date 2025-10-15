"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

export default function ManagerDashboard() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [requests, setRequests] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", phone: "", role: "", location_id: "" });
  const ROLE_OPTIONS = ["Bartender", "Server", "SA", "Shiftlead", "Manager", "Admin"];

  const [sectionsOpen, setSectionsOpen] = useState({
    addEmployee: true,
    timeOffRequests: true,
  });
  const toggleSection = (section) => setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));

  useEffect(() => {
    const fetchSessionAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      setSession(session);

      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("name, role")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (empError || !empData) {
        alert("Employee not found. Contact admin.");
        router.replace("/");
        return;
      }

      setUserRole(empData.role);
      setEmployeeName(empData.name);

      if (!["Manager", "Admin"].includes(empData.role)) {
        router.replace("/home");
        return;
      }

      await loadLocations();
      await loadRequests("pending");
      setLoading(false);
    };

    fetchSessionAndRole();
  }, [router]);

  const loadLocations = async () => {
    const { data, error } = await supabase.from("locations").select("*");
    if (error) console.error("Error loading locations:", error);
    else setLocations(data || []);
  };

  const loadRequests = async (status, locationId = "") => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      data = data.filter((r) => r.status?.toLowerCase() === status.toLowerCase());
      if (locationId) data = data.filter((r) => r.location_id === locationId);

      const authIds = [...new Set(data.map((r) => r.employee_auth_id))];
      const { data: empData } = await supabase
        .from("employees")
        .select("auth_id, name")
        .in("auth_id", authIds);

      const empMap = {};
      (empData || []).forEach((e) => (empMap[e.auth_id] = e.name));

      // Fetch manager names for approved_by and denied_by
      const managerIds = [
        ...new Set(
          data.map(r => r.approved_by).filter(Boolean)
            .concat(data.map(r => r.denied_by).filter(Boolean))
        )
      ];
      const { data: managerData } = await supabase
        .from("employees")
        .select("auth_id, name")
        .in("auth_id", managerIds);
      const managerMap = {};
      (managerData || []).forEach((m) => (managerMap[m.auth_id] = m.name));

      setRequests(
        data.map((r) => ({
          ...r,
          employee_name: empMap[r.employee_auth_id] || "-",
          approved_by_name: r.approved_by ? managerMap[r.approved_by] || "-" : "-",
          denied_by_name: r.denied_by ? managerMap[r.denied_by] || "-" : "-",
          status: r.status?.toLowerCase() || "pending"
        }))
      );
    } catch (err) {
      console.error("Error fetching requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (requestId, decision) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const managerAuthId = sessionData?.session?.user?.id;

    const updateData = { status: decision };
    if (decision === "approved") updateData.approved_by = managerAuthId;
    if (decision === "denied") updateData.denied_by = managerAuthId;

    const { error } = await supabase
      .from("time_off_requests")
      .update(updateData)
      .eq("id", requestId);

    if (error) {
      alert("Error updating request: " + error.message);
      return;
    }

    await loadRequests(filterStatus, selectedLocation);
  };

  const handleFilterChange = async (status) => {
    setFilterStatus(status);
    await loadRequests(status, selectedLocation);
  };

  const handleLocationChange = async (e) => {
    const loc = e.target.value;
    setSelectedLocation(loc);
    if (filterStatus) await loadRequests(filterStatus, loc);
  };

  const addEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.role || !newEmployee.location_id) {
      alert("Please fill name, email, role, and location.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(newEmployee.email)) {
      alert("Invalid email format.");
      return;
    }

    try {
      const res = await fetch("/api/create_employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmployee),
      });
      const result = await res.json();
      if (!res.ok) {
        alert("Error adding employee: " + (result?.error || res.statusText));
        return;
      }
      alert(`Employee created! Instructions have been sent to the employee via email."}`);
      setNewEmployee({ name: "", email: "", phone: "", role: "", location_id: "" });
    } catch (err) {
      console.error(err);
      alert("Error adding employee: " + err.message);
    }
  };

  if (loading) return <p className="p-6 text-white">Loading requests...</p>;

  const statusColors = {
    pending: "bg-yellow-500 text-black",
    approved: "bg-green-600 text-white",
    denied: "bg-red-600 text-white",
  };

  return (
    <div className="p-6 space-y-8 text-gray-200 bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold">
        Manager Dashboard - {employeeName} ({format(new Date(), "MM/dd/yyyy")})
      </h1>

      {/* ---------------- Add Employee Section ---------------- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection("addEmployee")}>
          <h2 className="text-xl font-semibold border-b border-gray-700 pb-2 mb-2">Add a New Employee</h2>
          <span>{sectionsOpen.addEmployee ? "▲" : "▼"}</span>
        </div>
        {sectionsOpen.addEmployee && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              className="border rounded p-2 w-full bg-gray-700 text-gray-200"
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              className="border rounded p-2 w-full bg-gray-700 text-gray-200"
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
            />
            <input
              type="text"
              placeholder="Phone"
              className="border rounded p-2 w-full bg-gray-700 text-gray-200"
              value={newEmployee.phone}
              onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
            />
            <select
              className="border rounded p-2 w-full bg-gray-700 text-gray-200"
              value={newEmployee.role}
              onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
            >
              <option value="">Select Role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              className="border rounded p-2 w-full bg-gray-700 text-gray-200"
              value={newEmployee.location_id}
              onChange={(e) => setNewEmployee({ ...newEmployee, location_id: e.target.value })}
            >
              <option value="">Select Location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <button
              onClick={addEmployee}
              className="bg-green-600 hover:bg-green-500 text-white font-semibold rounded p-2 w-full"
            >
              Add Employee
            </button>
          </div>
        )}
      </div>

      {/* ---------------- Time Off Requests Section ---------------- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection("timeOffRequests")}>
          <h2 className="text-xl font-semibold border-b border-gray-700 pb-2 mb-2">Time Off Requests</h2>
          <span>{sectionsOpen.timeOffRequests ? "▲" : "▼"}</span>
        </div>
        {sectionsOpen.timeOffRequests && (
          <>
            <div className="mb-4 flex gap-2 flex-wrap">
              {["pending", "approved", "denied"].map((status) => (
                <button
                  key={status}
                  className={`px-3 py-1 rounded font-semibold ${filterStatus === status ? statusColors[status] : "bg-gray-700 text-gray-200"}`}
                  onClick={() => handleFilterChange(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}

              <select
                className="border p-2 rounded ml-4 bg-gray-700 text-gray-200"
                value={selectedLocation}
                onChange={handleLocationChange}
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {requests.length === 0 ? (
              <p>No {filterStatus} time-off requests at this time.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="border-collapse border w-full text-left bg-gray-800 rounded">
                  <thead>
                    <tr>
                      {["Employee", "Start Date", "End Date", "Reason", "Location", "Approved/Denied By", "Actions"].map((header) => (
                        <th key={header} className="border p-2">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-700 transition">
                        <td className="border p-2">{req.employee_name}</td>
                        <td className="border p-2">{format(new Date(req.start_date), "MM/dd/yyyy")}</td>
                        <td className="border p-2">{format(new Date(req.end_date), "MM/dd/yyyy")}</td>
                        <td className="border p-2">{req.reason || "-"}</td>
                        <td className="border p-2">{locations.find((loc) => loc.id === req.location_id)?.name || "-"}</td>
                        <td className="border p-2">{req.status === "approved" ? req.approved_by_name : req.status === "denied" ? req.denied_by_name : "-"}</td>
                        <td className="border p-2 flex gap-2">
                          {req.status === "pending" ? (
                            <>
                              <button
                                onClick={() => handleDecision(req.id, "approved")}
                                className="bg-green-500 hover:bg-green-400 text-white px-2 py-1 rounded"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDecision(req.id, "denied")}
                                className="bg-red-500 hover:bg-red-400 text-white px-2 py-1 rounded"
                              >
                                Deny
                              </button>
                            </>
                          ) : (
                            <span className={req.status === "approved" ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
