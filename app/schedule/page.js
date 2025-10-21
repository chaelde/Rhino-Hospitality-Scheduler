"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format, addDays, getDay } from "date-fns";

export default function FullSchedulePage() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [shifts, setShifts] = useState([]);
  const [pars, setPars] = useState([]);
  const [blockedDates, setBlockedDates] = useState({});
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [loading, setLoading] = useState(true);
  const [statuses] = useState(["Absent", "Tardy", ""]);
  const [employeeNotes, setEmployeeNotes] = useState({});
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteHoverId, setNoteHoverId] = useState(null);
  const [publishing, setPublishing] = useState(false);

  function getMonday(d) {
    const date = new Date(d);
    const day = getDay(date);
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const isLunchShift = (shift) =>
    shift.end_time && new Date(`1970-01-01T${shift.end_time}`) <= new Date("1970-01-01T17:00");

  const isDinnerShift = (shift) => !isLunchShift(shift);

  const getScheduledCount = (role, date, type) =>
    shifts.filter(
      (s) =>
        s.role === role &&
        s.date === format(date, "yyyy-MM-dd") &&
        ((type === "lunch" && isLunchShift(s)) || (type === "dinner" && isDinnerShift(s)))
    ).length;

  const getNeed = (role, date, type) => {
    const scheduled = getScheduledCount(role, date, type);
    const parRecord = pars.find((p) => p.role === role);
    const parValue = type === "lunch" ? parRecord?.brunch_lunch_par || 0 : parRecord?.dinner_par || 0;
    return scheduled - parValue;
  };

  const getEmployeeShiftsByDay = (empId, day) =>
    shifts.filter((s) => s.employee_id === empId && s.date === format(day, "yyyy-MM-dd"));

  const getWeeklyHours = (empId) =>
    shifts
      .filter((s) => s.employee_id === empId)
      .reduce(
        (total, s) =>
          s.start_time && s.end_time
            ? total + (new Date(`1970-01-01T${s.end_time}`) - new Date(`1970-01-01T${s.start_time}`)) / (1000 * 60 * 60)
            : total,
        0
      );

  const isDateBlocked = (empAuthId, date) =>
    blockedDates[empAuthId]?.some((b) => b.date === format(date, "yyyy-MM-dd"));
  // ---------------- Auth ----------------
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return (window.location.href = "/login");

      setUser(session.user);
      const { data: emp, error } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();

      if (error || !emp) {
        alert("Access denied");
        return (window.location.href = "/");
      }

      setEmployee(emp);
    };

    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    checkUser();
    return () => subscription?.unsubscribe();
  }, []);

  // ---------------- Locations ----------------
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from("locations").select("*");
      setLocations(data || []);
    };
    fetchLocations();
  }, []);

  // ---------------- Employees ----------------
  useEffect(() => {
    if (!employee) return;
    const fetchEmployees = async () => {
      setLoading(true);
      let empQuery = supabase.from("employees").select("*, employee_locations(location_id)");
      if (!["Manager", "Admin"].includes(employee.role))
        empQuery = empQuery.eq("auth_id", employee.auth_id);

      const { data, error } = await empQuery;
      let filteredEmployees = data || [];

      // Filter by selected location if set
      if (selectedLocation) {
        filteredEmployees = filteredEmployees.filter((emp) =>
          (emp.employee_locations || []).some((loc) => loc.location_id === selectedLocation)
        );
      }

      setEmployees(filteredEmployees);
      setLoading(false);
    };
    fetchEmployees();
  }, [employee, selectedLocation]);
  // ---------------- PARs ----------------
  useEffect(() => {
    if (!selectedLocation) return;
    const fetchPars = async () => {
      const { data } = await supabase
        .from("pars")
        .select("*")
        .eq("location_id", selectedLocation);
      setPars(data || []);
    };
    fetchPars();
  }, [selectedLocation]);

  // ---------------- Shifts ----------------
  useEffect(() => {
    if (!employee || !selectedLocation) return;
    const fetchShifts = async () => {
      setLoading(true);
      let query = supabase
        .from("shifts")
        .select("*")
        .eq("location_id", selectedLocation)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date", { ascending: true });
      if (!["Manager", "Admin"].includes(employee.role))
        query = query.eq("employee_auth_id", employee.auth_id);
      const { data, error } = await query;
      if (error) {
        console.error(error);
        setShifts([]);
      } else setShifts(data || []);
      setLoading(false);
    };
    fetchShifts();
  }, [employee, selectedLocation, weekStart]);

  // ...imports remain unchanged

// ---------------- Blocked Dates ----------------
useEffect(() => {
  if (!selectedLocation || employees.length === 0) return;
  const fetchBlocked = async () => {
    const authIds = employees.map((e) => e.auth_id).filter(Boolean);
    if (authIds.length === 0) return setBlockedDates({});
    const { data } = await supabase
      .from("time_off_requests")
      .select("employee_auth_id,start_date,end_date,status,reason")
      .eq("status", "approved")
      .in("employee_auth_id", authIds);

    const blocked = {};
    (data || []).forEach((r) => {
      const s = new Date(r.start_date + "T00:00"); // force local time
      const e = new Date(r.end_date + "T00:00");
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dayStr = format(d, "yyyy-MM-dd");
        if (!blocked[r.employee_auth_id]) blocked[r.employee_auth_id] = [];
        blocked[r.employee_auth_id].push({ date: dayStr, reason: r.reason });
      }
    });
    setBlockedDates(blocked);
  };
  fetchBlocked();
}, [employees, selectedLocation]);


  // ---------------- Employee Notes ----------------
  useEffect(() => {
    if (employees.length === 0) return;
    const fetchNotes = async () => {
      const { data } = await supabase.from("employee_notes").select("*");
      const notesObj = {};
      (data || []).forEach((n) => {
        notesObj[n.employee_id] = n.note;
      });
      setEmployeeNotes(notesObj);
    };
    fetchNotes();
  }, [employees]);

  const canManage = employee && (employee.role === "Manager" || employee.role === "Admin");
  // ---------------- Shift Handlers ----------------
  const handleAddShift = async (empId, date) => {
    if (!canManage) return;
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    if (isDateBlocked(emp.auth_id, date)) {
      alert("Cannot schedule shift: employee has approved time off on this date.");
      return;
    }
    const { data: otherShifts } = await supabase
      .from("shifts")
      .select("location_id")
      .eq("employee_id", empId)
      .eq("date", date);
    if (otherShifts?.some((s) => s.location_id !== selectedLocation)) {
      alert("Employee already has a shift at another location.");
      return;
    }
    const defaultRole = pars.length > 0 ? pars[0].role : emp.role || "Server";
    const { data, error } = await supabase
      .from("shifts")
      .insert([
        {
          employee_id: emp.id,
          employee_auth_id: emp.auth_id,
          date,
          week_start: format(weekStart, "yyyy-MM-dd"),
          role: defaultRole,
          start_time: "09:00",
          end_time: "17:00",
          location_id: selectedLocation,
          published: false,
          status: "",
        },
      ])
      .select();
    if (error) return alert("Failed to create shift.");
    setShifts((prev) => [...prev, ...data]);
  };

  const handleUpdateShift = async (id, field, val) => {
    if (!canManage) return;
    const shift = shifts.find((s) => s.id === id);
    if (!shift || shift.location_id !== selectedLocation) return; // read-only if not current location
    await supabase.from("shifts").update({ [field]: val }).eq("id", id);
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  };

  const handleDeleteShift = async (id) => {
    if (!canManage) return;
    const shift = shifts.find((s) => s.id === id);
    if (!shift || shift.location_id !== selectedLocation) return; // read-only if not current location
    await supabase.from("shifts").delete().eq("id", id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
  };

  // ---------------- Publish / Unpublish ----------------
  const handlePublishWeek = async () => {
    if (!canManage || !selectedLocation) return;
    if (!confirm("Are you sure you want to publish this schedule? Employees will be notified.")) return;

    setPublishing(true);
    try {
      const { error: updateError } = await supabase
        .from("shifts")
        .update({ published: true })
        .eq("location_id", selectedLocation)
        .eq("week_start", format(weekStart, "yyyy-MM-dd"));
      if (updateError) throw updateError;

      setShifts((prev) => prev.map((s) => (s.location_id === selectedLocation ? { ...s, published: true } : s)));

      const res = await fetch("/api/schedule-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: selectedLocation,
          week_start: format(weekStart, "yyyy-MM-dd"),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send notifications");

      alert(
        data.failed?.length
          ? `Schedule published, but failed to email: ${data.failed.join(", ")}`
          : "✅ Schedule published and all employees notified!"
      );
    } catch (err) {
      console.error(err);
      alert("Error publishing schedule: " + (err.message || err));
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublishWeek = async () => {
    if (!canManage) return;
    if (!confirm("Are you sure you want to unpublish this schedule?")) return;

    try {
      const { error } = await supabase
        .from("shifts")
        .update({ published: false })
        .eq("location_id", selectedLocation)
        .eq("week_start", format(weekStart, "yyyy-MM-dd"));
      if (error) throw error;

      setShifts((prev) => prev.map((s) => (s.location_id === selectedLocation ? { ...s, published: false } : s)));
      alert("Schedule unpublished.");
    } catch (err) {
      console.error(err);
      alert("Error unpublishing schedule: " + err.message);
    }
  };

  // ---------------- Week Navigation ----------------
  const handlePrevWeek = () => setWeekStart(getMonday(addDays(weekStart, -7)));
  const handleNextWeek = () => setWeekStart(getMonday(addDays(weekStart, 7)));
  const handleCurrentWeek = () => setWeekStart(getMonday(new Date()));

  // ---------------- Employee Notes ----------------
  const handleSaveNote = async (empId) => {
    const note = employeeNotes[empId] || "";
    const { data, error } = await supabase
      .from("employee_notes")
      .upsert({ employee_id: empId, note })
      .select();
    if (error) console.error(error);
    setEditingNoteId(null);
  };

  if (!user || !employee) return <p className="text-gray-400">Loading...</p>;

  const roles = [...new Set(pars.map((p) => p.role))].sort();
  const weekUnpublished = shifts.some((s) => s.location_id === selectedLocation && !s.published);
  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-200">
      {weekUnpublished && canManage && (
        <div className="bg-yellow-800 text-yellow-200 font-semibold p-3 rounded-lg mb-4 shadow">
          ⚠️ Schedule is not published yet
        </div>
      )}

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <label className="font-semibold text-gray-200">Location:</label>
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="border border-gray-700 p-2 rounded-lg bg-gray-800 text-gray-200 shadow-sm"
        >
          <option value="">-- Select a location --</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedLocation ? (
        <p className="text-gray-400">Please select a location.</p>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-200 mb-4">
            Week of {format(weekStart, "MM/dd")} - {format(weekEnd, "MM/dd")}
          </h2>

          <div className="mb-6 flex gap-3 flex-wrap">
            <button onClick={handlePrevWeek} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">
              Prev Week
            </button>
            <button onClick={handleCurrentWeek} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500">
              Current Week
            </button>
            <button onClick={handleNextWeek} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">
              Next Week
            </button>
            {canManage && (
              <>
                <button
                  onClick={handlePublishWeek}
                  disabled={publishing}
                  className={`px-4 py-2 rounded-lg text-white ${
                    publishing ? "bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"
                  }`}
                >
                  {publishing ? "Publishing..." : "Publish Week"}
                </button>
                <button
                  onClick={handleUnpublishWeek}
                  className="px-4 py-2 rounded-lg bg-yellow-700 text-yellow-200 hover:bg-yellow-600"
                >
                  Unpublish Week
                </button>
              </>
            )}
          </div>

          {/* PAR Table */}
          {canManage && (
            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse shadow rounded-lg overflow-hidden bg-gray-800 text-gray-200">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">Role</th>
                    {weekDays.map((day) => (
                      <th key={day} className="p-3 text-center">{format(day, "EEE MM/dd")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role} className="border-b border-gray-600">
                      <td className="p-3 font-semibold">{role}</td>
                      {weekDays.map((day) => {
                        const lunchNeed = getNeed(role, day, "lunch");
                        const dinnerNeed = getNeed(role, day, "dinner");

                        const lunchClass =
                          lunchNeed < 0
                            ? "bg-red-900 text-red-300 font-semibold p-1 rounded"
                            : lunchNeed > 0
                            ? "bg-green-900 text-green-300 font-semibold p-1 rounded"
                            : "bg-gray-700 text-gray-200 font-medium p-1 rounded";

                        const dinnerClass =
                          dinnerNeed < 0
                            ? "bg-red-900 text-red-300 font-semibold p-1 rounded"
                            : dinnerNeed > 0
                            ? "bg-green-900 text-green-300 font-semibold p-1 rounded"
                            : "bg-gray-700 text-gray-200 font-medium p-1 rounded";

                        return (
                          <td key={day} className="p-2 text-center space-y-1">
                            <div className={lunchClass}>Br: {lunchNeed}</div>
                            <div className={dinnerClass}>Dn: {dinnerNeed}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Employee Schedule */}
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse shadow rounded-lg overflow-hidden bg-gray-800 text-gray-200">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">Employee</th>
                    {weekDays.map((day) => (
                      <th key={day} className="p-3 text-center">{format(day, "EEE MM/dd")}</th>
                    ))}
                    <th className="p-3 text-center">Weekly Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {employees
                    .filter(emp => emp.employee_locations.some(loc => loc.location_id === selectedLocation))
                    .map((emp) => {
                    const weeklyHours = getWeeklyHours(emp.id);
                    const overtime = weeklyHours > 40;

                    return (
                      <tr key={emp.id} className="border-b border-gray-600">
                        <td
                          className="p-3 font-medium text-gray-200 relative"
                          onMouseEnter={() => setNoteHoverId(emp.id)}
                          onMouseLeave={() => setNoteHoverId(null)}
                        >
                          {emp.name}
                          {noteHoverId === emp.id && (
                            <div className="absolute left-full top-0 ml-2 p-2 bg-gray-800 border border-gray-700 rounded w-64 z-10 shadow-lg">
                              {editingNoteId === emp.id ? (
                                <>
                                  <textarea
                                    value={employeeNotes[emp.id] || ""}
                                    onChange={(e) =>
                                      setEmployeeNotes((prev) => ({ ...prev, [emp.id]: e.target.value }))
                                    }
                                    className="w-full p-1 rounded bg-gray-700 text-gray-200 mb-1"
                                  />
                                  <button
                                    onClick={() => handleSaveNote(emp.id)}
                                    className="bg-blue-600 text-white px-2 py-1 rounded mr-1"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNoteId(null)}
                                    className="bg-gray-600 text-white px-2 py-1 rounded"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="mb-1 whitespace-pre-wrap">
                                    {employeeNotes[emp.id] || "No notes"}
                                  </div>
                                  {canManage && (
                                    <button
                                      onClick={() => setEditingNoteId(emp.id)}
                                      className="bg-green-600 text-white px-2 py-1 rounded"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        {weekDays.map((day) => {
                          const shiftsForDay = shifts.filter(s => s.employee_id === emp.id && s.date === format(day, "yyyy-MM-dd"));
                          const blocked = blockedDates[emp.auth_id]?.find(b => b.date === format(day, "yyyy-MM-dd"));

                          return (
                            <td key={day} className="p-2 text-center space-y-1">
                              {shiftsForDay.length === 0 && blocked && (
                                <div className="text-red-400 font-bold mt-1 text-center">
                                  Approved Time Off
                                  {blocked.reason && <div className="text-sm">{blocked.reason}</div>}
                                </div>
                              )}
                              {shiftsForDay.map((s) => {
                                const isBlocked = blockedDates[emp.auth_id]?.find(
                                  (b) => b.date === format(day, "yyyy-MM-dd")
                                );

                                const isEditable = s.location_id === selectedLocation; // editable only at current location
                                const shiftCardClass = isBlocked
                                  ? "bg-red-900"
                                  : s.published
                                  ? "bg-gray-800 border border-gray-600 rounded p-2 shadow-sm"
                                  : "bg-gray-700";

                                return (
                                  <div key={s.id} className={`mb-1 ${shiftCardClass}`}>
                                    {s.published ? (
                                      <>
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-semibold">{s.role}</span>
                                          <span>
                                            {s.start_time} - {s.end_time}
                                            {s.location_id !== selectedLocation && ` (Other Loc)`}
                                          </span>
                                        </div>
                                        <select
                                          value={s.status || ""}
                                          disabled={!canManage || !isEditable}
                                          onChange={(e) => canManage && handleUpdateShift(s.id, "status", e.target.value)}
                                          className="border p-1 w-full rounded bg-gray-700 text-gray-200"
                                        >
                                          <option value="">None</option>
                                          {statuses.map(st => st && <option key={st} value={st}>{st}</option>)}
                                        </select>
                                      </>
                                    ) : (
                                      <>
                                        <select
                                          value={s.role}
                                          disabled={!canManage || !isEditable || isBlocked}
                                          onChange={(e) => handleUpdateShift(s.id, "role", e.target.value)}
                                          className="border p-1 mb-1 w-full rounded bg-gray-800 text-gray-200"
                                        >
                                          {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>

                                        <div className="flex gap-1 mb-1">
                                          <input
                                            type="time"
                                            value={s.start_time}
                                            disabled={!canManage || !isEditable}
                                            onChange={(e) => handleUpdateShift(s.id, "start_time", e.target.value)}
                                            className="border p-1 flex-1 rounded bg-gray-800 text-gray-200"
                                          />
                                          <input
                                            type="time"
                                            value={s.end_time}
                                            disabled={!canManage || !isEditable}
                                            onChange={(e) => handleUpdateShift(s.id, "end_time", e.target.value)}
                                            className="border p-1 flex-1 rounded bg-gray-800 text-gray-200"
                                          />
                                        </div>

                                        <select
                                          value={s.status || ""}
                                          disabled={!canManage || !isEditable}
                                          onChange={(e) => handleUpdateShift(s.id, "status", e.target.value)}
                                          className="border p-1 w-full rounded bg-gray-800 text-gray-200"
                                        >
                                          <option value="">None</option>
                                          {statuses.map(st => st && <option key={st} value={st}>{st}</option>)}
                                        </select>

                                        {canManage && isEditable && !isBlocked && (
                                          <button
                                            onClick={() => handleDeleteShift(s.id)}
                                            className="bg-red-600 text-white px-2 py-1 rounded mt-1 w-full hover:bg-red-500"
                                          >
                                            Delete
                                          </button>
                                        )}

                                        {isBlocked && (
                                          <div className="text-red-400 font-bold mt-1 text-center">
                                            Approved Time Off
                                            {isBlocked.reason && <div className="text-sm">{isBlocked.reason}</div>}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                             {canManage && (
  blocked ? (
    <div className="text-red-400 font-bold mt-1 text-center">
      Approved Time Off
      {blocked.reason && <div className="text-sm">{blocked.reason}</div>}
    </div>
  ) : (
    <button
      onClick={() => handleAddShift(emp.id, format(day, "yyyy-MM-dd"))}
      className="bg-blue-600 text-white px-2 py-1 rounded mt-1 w-full hover:bg-blue-500"
    >
      + Shift
    </button>
  )
)}

                            </td>
                          );
                        })}
                        <td className={`p-3 text-center ${overtime ? "text-red-500 font-semibold" : ""}`}>
                          {weeklyHours.toFixed(1)} hrs {overtime && "(OT)"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile View */}
          <div className="grid md:hidden gap-3 mt-6">
            {employees
              .filter(emp => emp.employee_locations.some(loc => loc.location_id === selectedLocation))
              .map(emp => (
              <div key={emp.id} className="border p-3 rounded shadow-sm bg-gray-800">
                <div className="font-semibold">{emp.name}</div>
                <div className="text-sm text-gray-500">{emp.position}</div>
                <div className="text-sm mt-1">Hours: {getWeeklyHours(emp.id).toFixed(1)}</div>

                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-1">Notes:</div>
                  {editingNoteId === emp.id ? (
                    <div className="flex gap-2">
                      <input
                        value={employeeNotes[emp.id] || ""}
                        onChange={e => setEmployeeNotes(prev => ({ ...prev, [emp.id]: e.target.value }))}
                        className="border p-1 flex-1 rounded bg-gray-700 text-gray-200"
                      />
                      <button
                        onClick={() => handleSaveNote(emp.id)}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span>{employeeNotes[emp.id] || ""}</span>
                      {canManage && (
                        <button
                          onClick={() => setEditingNoteId(emp.id)}
                          className="text-blue-400 text-xs underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
