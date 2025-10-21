"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  format,
  isAfter,
  parseISO,
  subMonths,
} from "date-fns";

export default function EmployeesPage() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [employees, setEmployees] = useState([]);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [employeeEdits, setEmployeeEdits] = useState({});
  const [locations, setLocations] = useState([]);
  const [employeeLocations, setEmployeeLocations] = useState([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [loading, setLoading] = useState(true);

  const [scheduleWeek, setScheduleWeek] = useState(new Date());
  const [expandedEmployeeAuthId, setExpandedEmployeeAuthId] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [timeOffByDate, setTimeOffByDate] = useState({});
  const [attendanceCounts, setAttendanceCounts] = useState({});
  const [attendanceSummary, setAttendanceSummary] = useState({
    absences: 0,
    tardies: 0,
  });

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceModalType, setAttendanceModalType] = useState(null);
  const [attendanceDetails, setAttendanceDetails] = useState([]);

  // ----------------- INIT -----------------
  useEffect(() => {
    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session) {
          window.location.href = "/login";
          return;
        }
        setSession(data.session);

        const { data: empData, error: empError } = await supabase
          .from("employees")
          .select("role")
          .eq("auth_id", data.session.user.id)
          .single();

        if (empError || !empData) {
          console.error("Employee lookup error:", empError);
          alert("Employee not found. Please contact admin.");
          window.location.href = "/";
          return;
        }

        setUserRole(empData.role);
        await loadData(empData.role, data.session);
      } catch (err) {
        console.error("Init error:", err);
        alert("Error initializing page. See console.");
      }
    }

    init();
  }, []);

  // ----------------- LOAD EMPLOYEES & LOCATIONS -----------------
  async function loadData(role, sessionData = null) {
    setLoading(true);
    try {
      const { data: locData, error: locError } = await supabase
        .from("locations")
        .select("*");
      setLocations(locError ? [] : locData || []);

      let empQuery = supabase.from("employees").select("*");
      if (!["Manager", "Admin"].includes(role)) {
        const currentSession =
          sessionData || (await supabase.auth.getSession()).data.session;
        const authId = currentSession?.user?.id;
        if (!authId) {
          setEmployees([]);
          setLoading(false);
          return;
        }
        empQuery = empQuery.eq("auth_id", authId);
      }

      const { data: empData, error: empError } = await empQuery;
      setEmployees(empError ? [] : empData || []);

      const { data: empLocData } = await supabase
        .from("employee_locations")
        .select("employee_id, location_id");
      setEmployeeLocations(empLocData || []);
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ----------------- ATTENDANCE COUNTS -----------------
  async function updateAttendanceCountsRolling12Months() {
    try {
      const now = new Date();
      const twelveMonthsAgo = subMonths(now, 12);

      const { data: shiftRows } = await supabase
        .from("shifts")
        .select("employee_auth_id, status")
        .gte("date", format(twelveMonthsAgo, "yyyy-MM-dd"))
        .lte("date", format(now, "yyyy-MM-dd"))
        .eq("published", true);

      const counts = {};
      (shiftRows || []).forEach((r) => {
        const auth = r.employee_auth_id;
        if (!auth) return;
        if (!counts[auth]) counts[auth] = { absences: 0, tardies: 0 };
        const st = String(r.status || "").toLowerCase();
        if (st === "absent") counts[auth].absences++;
        if (st === "tardy") counts[auth].tardies++;
      });

      setAttendanceCounts(counts);
      if (expandedEmployeeAuthId)
        setAttendanceSummary(
          counts[expandedEmployeeAuthId] || { absences: 0, tardies: 0 }
        );
    } catch (err) {
      console.error("Error building attendance counts:", err);
      setAttendanceCounts({});
      setAttendanceSummary({ absences: 0, tardies: 0 });
    }
  }

  useEffect(() => {
    updateAttendanceCountsRolling12Months();
  }, [employees]);

  // ----------------- FETCH SHIFTS & TIME OFF -----------------
  async function fetchShiftsAndTimeOff(employeeAuthId, weekDate) {
    try {
      const start = startOfWeek(weekDate, { weekStartsOn: 1 });
      const end = endOfWeek(weekDate, { weekStartsOn: 1 });

      const { data: shiftData } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_auth_id", employeeAuthId)
        .eq("published", true)
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"))
        .order("date", { ascending: true });

      const { data: torData } = await supabase
        .from("time_off_requests")
        .select("start_date, end_date, reason, status")
        .eq("employee_auth_id", employeeAuthId)
        .eq("status", "approved");

      const torByDate = {};
      (torData || []).forEach((r) => {
        const s = parseISO(r.start_date);
        const e = parseISO(r.end_date);
        for (let d = new Date(s); !isAfter(d, e); d = addDays(d, 1)) {
          const dateStr = format(d, "yyyy-MM-dd");
          if (!torByDate[dateStr]) torByDate[dateStr] = [];
          torByDate[dateStr].push(r);
        }
      });

      let summary = { absences: 0, tardies: 0 };
      if (attendanceCounts[employeeAuthId])
        summary = attendanceCounts[employeeAuthId];

      setShifts(shiftData || []);
      setTimeOffByDate(torByDate);
      setAttendanceSummary(summary);
    } catch (err) {
      console.error("fetchShiftsAndTimeOff error:", err);
      setShifts([]);
      setTimeOffByDate({});
      setAttendanceSummary({ absences: 0, tardies: 0 });
    }
  }

  // ----------------- ATTENDANCE DETAIL MODAL -----------------
  async function handleAttendanceClick(empAuthId, type) {
    try {
      const now = new Date();
      const twelveMonthsAgo = subMonths(now, 12);

      const { data: detailRows, error } = await supabase
        .from("shifts")
        .select("date, status, location_id, start_time, end_time, role")
        .eq("employee_auth_id", empAuthId)
        .gte("date", format(twelveMonthsAgo, "yyyy-MM-dd"))
        .lte("date", format(now, "yyyy-MM-dd"))
        .eq("published", true)
        .order("date", { ascending: false });

      if (error) throw error;

      const filtered = (detailRows || []).filter(
        (r) => r.status?.toLowerCase() === type.toLowerCase()
      );

      const withLocation = filtered.map((r) => {
        const loc = locations.find((l) => l.id === r.location_id);
        return {
          ...r,
          location_name: loc ? loc.name : "Unknown",
        };
      });

      setAttendanceDetails(withLocation);
      setAttendanceModalType(type);
      setShowAttendanceModal(true);
    } catch (err) {
      console.error("Error fetching attendance details:", err);
    }
  }

  function closeAttendanceModal() {
    setShowAttendanceModal(false);
    setAttendanceModalType(null);
    setAttendanceDetails([]);
  }

  // ----------------- VIEW SCHEDULE -----------------
  function handleViewSchedule(emp) {
    const nextAuthId = expandedEmployeeAuthId === emp.auth_id ? null : emp.auth_id;
    setExpandedEmployeeAuthId(nextAuthId);
    setShifts([]);
    setTimeOffByDate({});
    setAttendanceSummary({ absences: 0, tardies: 0 });
    if (nextAuthId) fetchShiftsAndTimeOff(nextAuthId, scheduleWeek);
  }

  function changeWeek(offset) {
    const newWeek = addWeeks(scheduleWeek, offset);
    setScheduleWeek(newWeek);
    if (expandedEmployeeAuthId) fetchShiftsAndTimeOff(expandedEmployeeAuthId, newWeek);
  }

  function jumpToCurrentWeek() {
    const today = new Date();
    setScheduleWeek(today);
    if (expandedEmployeeAuthId) fetchShiftsAndTimeOff(expandedEmployeeAuthId, today);
  }

  function getEmployeeLocationIds(empId) {
    return employeeLocations
      .filter((el) => el.employee_id === empId)
      .map((el) => el.location_id);
  }

 const filteredEmployees = filterLocation
  ? employees.filter((e) =>
      getEmployeeLocationIds(e.id).includes(filterLocation)
    )
  : employees;

  const weekDays = Array.from({ length: 7 }).map((_, i) =>
    addDays(startOfWeek(scheduleWeek, { weekStartsOn: 1 }), i)
  );

  // ----------------- PHONE FORMATTER -----------------
  function formatPhoneNumber(value) {
    const cleaned = ("" + (value || "")).replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    const [, area, prefix, line] = match;
    if (line) return `(${area}) ${prefix}-${line}`;
    if (prefix) return `(${area}) ${prefix}`;
    if (area) return `(${area}`;
    return "";
  }

  function handlePhoneChange(e) {
    const raw = e.target.value;
    const cleaned = raw.replace(/\D/g, "");
    const formatted = formatPhoneNumber(cleaned);
    setEmployeeEdits((prev) => ({ ...prev, phone: formatted }));
  }

  // ----------------- EDIT HANDLERS -----------------
  function handleEditClick(emp) {
    const currentLocs = getEmployeeLocationIds(emp.id);
    setEditingEmployeeId(emp.id);
    setEmployeeEdits({
      ...emp,
      phone: emp.phone ? formatPhoneNumber(emp.phone) : "",
      location_ids: currentLocs,
    });
  }

  function handleCancelEdit() {
    setEditingEmployeeId(null);
    setEmployeeEdits({});
  }

  async function handleSaveEdit(empId) {
    try {
      const updated = { ...employeeEdits };
      if (!["Manager", "Admin"].includes(userRole)) return;

      const phoneToSave = (updated.phone || "").replace(/\D/g, "");
      const storedPhone = phoneToSave ? formatPhoneNumber(phoneToSave) : null;

      const { error: empError } = await supabase
        .from("employees")
        .update({
          name: updated.name,
          email: updated.email,
          phone: storedPhone,
          role: updated.role,
        })
        .eq("id", empId);
      if (empError) throw empError;

      const { error: delErr } = await supabase
        .from("employee_locations")
        .delete()
        .eq("employee_id", empId);
      if (delErr) throw delErr;

      if (updated.location_ids?.length > 0) {
        const inserts = updated.location_ids.map((locId) => ({
          employee_id: empId,
          location_id: locId,
        }));
        const { error: insertError } = await supabase
          .from("employee_locations")
          .insert(inserts);
        if (insertError) throw insertError;
      }

      await loadData(userRole, session);
      handleCancelEdit();
    } catch (err) {
      console.error("Error saving employee:", err);
      alert("Failed to save changes. Check console for details.");
    }
  }

  // ----------------- DELETE HANDLER -----------------
  async function handleDelete(emp) {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    try {
      const res = await fetch("/api/delete-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_id: emp.auth_id }),
      });
      if (!res.ok) throw new Error("Failed to delete employee");
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete employee");
    }
  }

  if (loading) return <p className="p-6 text-white">Loading employees...</p>;

  const ROLE_OPTIONS = ["Bartender", "Server", "SA", "Shiftlead", "Manager", "Admin"];

  // ----------------- RENDER -----------------
  return (
    <div className="p-6 bg-gray-900 text-gray-200 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-white">Employees</h1>

      <div className="mb-4 flex gap-2 flex-wrap">
        <select
          className="border border-gray-700 bg-gray-800 p-2 rounded text-gray-200"
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
        >
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse border border-gray-700 min-w-max w-full text-left mb-6">
          <thead className="bg-gray-800">
            <tr>
              <th className="border border-gray-700 p-2 text-gray-200">Name</th>
              <th className="border border-gray-700 p-2 text-gray-200">Email</th>
              <th className="border border-gray-700 p-2 text-gray-200">Phone</th>
              <th className="border border-gray-700 p-2 text-gray-200">Role</th>
              <th className="border border-gray-700 p-2 text-gray-200">Location(s)</th>
              <th className="border border-gray-700 p-2 text-center text-gray-200">
                <span className="underline">Absences</span>
              </th>
              <th className="border border-gray-700 p-2 text-center text-gray-200">
                <span className="underline">Tardies</span>
              </th>
              <th className="border border-gray-700 p-2 text-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => {
              const empLocIds = getEmployeeLocationIds(emp.id);
              const empLocNames = locations
                .filter((l) => empLocIds.includes(l.id))
                .map((l) => l.name)
                .join(", ");
              const empAttendance = attendanceCounts[emp.auth_id] || { absences: 0, tardies: 0 };

              return (
                <React.Fragment key={emp.id}>
                  <tr className="hover:bg-gray-800">
                    <td className="border border-gray-700 p-2">
                      {editingEmployeeId === emp.id ? (
                        <input
                          type="text"
                          className="bg-gray-800 border border-gray-600 p-1 text-gray-200 w-full"
                          value={employeeEdits.name || ""}
                          onChange={(e) =>
                            setEmployeeEdits((prev) => ({ ...prev, name: e.target.value }))
                          }
                        />
                      ) : (
                        emp.name
                      )}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {editingEmployeeId === emp.id ? (
                        <input
                          type="email"
                          className="bg-gray-800 border border-gray-600 p-1 text-gray-200 w-full"
                          value={employeeEdits.email || ""}
                          onChange={(e) =>
                            setEmployeeEdits((prev) => ({ ...prev, email: e.target.value }))
                          }
                        />
                      ) : (
                        emp.email
                      )}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {editingEmployeeId === emp.id ? (
                        <input
                          type="text"
                          className="bg-gray-800 border border-gray-600 p-1 text-gray-200 w-full"
                          value={employeeEdits.phone || ""}
                          onChange={handlePhoneChange}
                          placeholder="(000) 000-0000"
                        />
                      ) : (
                        emp.phone || ""
                      )}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {editingEmployeeId === emp.id ? (
                        <select
                          value={employeeEdits.role || ""}
                          onChange={(e) =>
                            setEmployeeEdits((prev) => ({ ...prev, role: e.target.value }))
                          }
                          className="bg-gray-800 border border-gray-600 p-1 text-gray-200 w-full"
                        >
                          <option value="">Select role</option>
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        emp.role
                      )}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {editingEmployeeId === emp.id ? (
                        <div className="flex flex-col max-h-40 overflow-auto p-1">
                          {locations.map((loc) => (
                            <label key={loc.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={(employeeEdits.location_ids || []).includes(loc.id)}
                                onChange={(e) => {
                                  const current = employeeEdits.location_ids || [];
                                  if (e.target.checked) {
                                    setEmployeeEdits((prev) => ({ ...prev, location_ids: [...current, loc.id] }));
                                  } else {
                                    setEmployeeEdits((prev) => ({
                                      ...prev,
                                      location_ids: current.filter((id) => id !== loc.id),
                                    }));
                                  }
                                }}
                              />
                              {loc.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        empLocNames || "—"
                      )}
                    </td>
                    <td className="border border-gray-700 p-2 text-center">
                      <button
                        onClick={() => handleAttendanceClick(emp.auth_id, "absent")}
                        className="underline text-sm"
                      >
                        {empAttendance.absences ?? 0}
                      </button>
                    </td>
                    <td className="border border-gray-700 p-2 text-center">
                      <button
                        onClick={() => handleAttendanceClick(emp.auth_id, "tardy")}
                        className="underline text-sm"
                      >
                        {empAttendance.tardies ?? 0}
                      </button>
                    </td>
                    <td className="border border-gray-700 p-2 flex gap-1 flex-wrap">
                      {editingEmployeeId === emp.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(emp.id)}
                            className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditClick(emp)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(emp)}
                            className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => handleViewSchedule(emp)}
                            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 px-2 py-1 rounded"
                          >
                            {expandedEmployeeAuthId === emp.auth_id ? "Hide Schedule" : "View Schedule"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {/* WEEKLY SCHEDULE VIEW */}
                  {expandedEmployeeAuthId === emp.auth_id && (
                    <tr>
                      <td colSpan={8} className="bg-gray-800 p-2 overflow-x-auto">
                        <div className="min-w-full">
                          {/* Week navigation inside expanded schedule */}
                          <div className="flex gap-2 mb-2 flex-wrap items-center">
                            <button
                              onClick={() => changeWeek(-1)}
                              className="border border-gray-700 px-2 py-1 rounded hover:bg-gray-900"
                            >
                              Previous Week
                            </button>
                            <button
                              onClick={jumpToCurrentWeek}
                              className="border border-gray-700 px-2 py-1 rounded hover:bg-gray-900"
                            >
                              Current Week
                            </button>
                            <button
                              onClick={() => changeWeek(1)}
                              className="border border-gray-700 px-2 py-1 rounded hover:bg-gray-900"
                            >
                              Next Week
                            </button>
                            <span className="ml-2 font-bold text-white">
                              Week of {format(startOfWeek(scheduleWeek, { weekStartsOn: 1 }), "MM/dd/yyyy")}
                            </span>
                          </div>

                          <table className="w-full border-collapse border border-gray-700 min-w-max">
                            <thead>
                              <tr>
                                {weekDays.map((d) => (
                                  <th
                                    key={d.toISOString()}
                                    className="border border-gray-700 p-2 text-gray-200"
                                  >
                                    {format(d, "EEE MM/dd")}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {weekDays.map((d) => {
                                  const dateStr = format(d, "yyyy-MM-dd");
                                  const dayShifts = (shifts || []).filter((s) => s.date === dateStr);
                                  const dayTimeOff = timeOffByDate[dateStr] || [];
                                  return (
                                    <td
                                      key={dateStr}
                                      className="border border-gray-700 p-2 align-top text-sm"
                                    >
                                      {dayTimeOff.length > 0 && (
                                        <div className="bg-red-600 text-white p-1 rounded mb-1">
                                          <strong>Approved Time Off</strong>
                                          {dayTimeOff.map((r, idx) => (
                                            <div key={idx} className="text-xs">
                                              {r.reason || ""}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {dayShifts.length > 0 ? (
                                        dayShifts.map((s) => {
                                          const loc = locations.find((l) => l.id === s.location_id);
                                          return (
                                            <div
                                              key={s.id}
                                              className="bg-green-700 text-white p-1 rounded mb-1"
                                            >
                                              <div className="font-semibold text-sm">
                                                {loc ? `${loc.name} — ${s.role}` : s.role}
                                              </div>
                                              <div className="text-xs">
                                                {s.start_time} - {s.end_time}
                                              </div>
                                              <div className="text-xs">Status: {s.status || "—"}</div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        !dayTimeOff.length && <div className="text-gray-400">—</div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                          <div className="mt-2 text-sm text-gray-300">
                            Absences: {attendanceSummary.absences}, Tardies: {attendanceSummary.tardies}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Attendance details modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white text-black rounded-lg w-full md:w-2/3 max-h-[80vh] overflow-auto p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">
                {attendanceModalType === "absent" ? "Absences" : "Tardies"} — Last 12 months
              </h3>
              <button onClick={closeAttendanceModal} className="text-sm underline">Close</button>
            </div>
            <div className="space-y-2">
              {attendanceDetails.length === 0 ? (
                <div className="text-sm text-gray-600">No records found.</div>
              ) : (
                attendanceDetails.map((r, idx) => (
                  <div key={idx} className="border rounded p-2">
                    <div className="text-sm font-semibold">{format(parseISO(r.date), "MMM d, yyyy")}</div>
                    <div className="text-xs">Role: {r.role || "—"}</div>
                    <div className="text-xs">Time: {r.start_time || "—"} - {r.end_time || "—"}</div>
                    <div className="text-xs">Location: {r.location_name}</div>
                    <div className="text-xs">Status: {r.status}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
