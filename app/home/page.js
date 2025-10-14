"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format, startOfWeek, endOfWeek, addDays, parseISO, isAfter, isBefore, subMonths } from "date-fns";
import EmployeeProfileForm from "@/components/employeeprofileform";
import useAuthRedirect from "@/lib/useAuthRedirect";

export default function EmployeeHomePage() {
  const loadingAuth = useAuthRedirect();
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduleWeek, setScheduleWeek] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [newRequest, setNewRequest] = useState({ start_date: "", end_date: "", reason: "" });
  const [attendance, setAttendance] = useState({ absences: 0, tardies: 0 });
  const [attendanceShifts, setAttendanceShifts] = useState([]);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Collapsible sections
  const [sectionsOpen, setSectionsOpen] = useState({
    profile: true,
    attendance: true,
    schedule: true,
    timeOffForm: true,
    timeOffList: true,
  });

  const toggleSection = (section) =>
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));

  // ---------------- Fetch Employee ----------------
  useEffect(() => {
    if (loadingAuth) return;

    async function fetchUser() {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) console.error(authError);
      if (!data?.user) return;

      setUser(data.user);

      const { data: empData, error } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_id", data.user.id)
        .single();

      if (error) console.error(error);
      setEmployee(empData);
      setLoading(false);
    }

    fetchUser();
  }, [loadingAuth]);

  // ---------------- Fetch Shifts ----------------
  useEffect(() => {
    if (!employee?.auth_id) return;

    async function fetchShifts() {
      try {
        const weekStart = startOfWeek(scheduleWeek, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(scheduleWeek, { weekStartsOn: 1 });

        const { data, error } = await supabase
          .from("shifts")
          .select("*, locations(name)")
          .eq("employee_auth_id", employee.auth_id)
          .eq("published", true)
          .gte("date", format(weekStart, "yyyy-MM-dd"))
          .lte("date", format(weekEnd, "yyyy-MM-dd"))
          .order("date", { ascending: true });

        if (error) throw error;
        setShifts(data || []);
      } catch (err) {
        console.error("Error fetching shifts:", err);
      }
    }

    fetchShifts();
  }, [employee, scheduleWeek]);

  // ---------------- Fetch Time-Off Requests ----------------
  useEffect(() => {
    if (!employee?.auth_id) return;

    async function fetchRequests() {
      setRequestsLoading(true);
      try {
        const { data, error } = await supabase
          .from("time_off_requests")
          .select("*")
          .eq("employee_auth_id", employee.auth_id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTimeOffRequests(data || []);
      } catch (err) {
        console.error("Error fetching time-off requests:", err);
      } finally {
        setRequestsLoading(false);
      }
    }

    fetchRequests();
  }, [employee]);

  // ---------------- Fetch Attendance (12 months) ----------------
  useEffect(() => {
    if (!employee?.auth_id) return;

    async function fetchAttendance() {
      try {
        const startDate = format(subMonths(new Date(), 12), "yyyy-MM-dd");
        const { data, error } = await supabase
          .from("shifts")
          .select("id,status,date,start_time,end_time,locations(name)")
          .eq("employee_auth_id", employee.auth_id)
          .gte("date", startDate);

        if (error) throw error;

        const absencesShifts = data.filter((s) => s.status?.toLowerCase() === "absent");
        const tardiesShifts = data.filter((s) => s.status?.toLowerCase() === "tardy");

        setAttendance({ absences: absencesShifts.length, tardies: tardiesShifts.length });
        setAttendanceShifts([...absencesShifts, ...tardiesShifts]);
      } catch (err) {
        console.error("Error fetching attendance:", err);
      }
    }

    fetchAttendance();
  }, [employee]);

  // ---------------- Time-Off Request Submission ----------------
  const submitTimeOffRequest = async (e) => {
    e.preventDefault();
    if (!employee?.auth_id) return alert("Employee not found");

    const { start_date, end_date, reason } = newRequest;
    if (!start_date || !end_date || !reason.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      const { error } = await supabase.from("time_off_requests").insert([
        {
          employee_auth_id: employee.auth_id,
          location_id: employee.location_id,
          start_date,
          end_date,
          reason,
          status: "Pending",
        },
      ]);

      if (error) throw error;

      setNewRequest({ start_date: "", end_date: "", reason: "" });

      const { data } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("employee_auth_id", employee.auth_id)
        .order("created_at", { ascending: false });

      setTimeOffRequests(data || []);
    } catch (err) {
      console.error("Error submitting time-off request:", err);
      alert("Failed to submit request: " + (err?.message || "Unknown error"));
    }
  };

  const changeWeek = (offset) => setScheduleWeek(addDays(scheduleWeek, offset * 7));
  const jumpToCurrentWeek = () => setScheduleWeek(new Date());

  if (loadingAuth || loading) return <p className="p-6 text-white">Loading...</p>;
  if (!employee) return <p className="p-6 text-white">Employee record not found.</p>;

  const weekStart = startOfWeek(scheduleWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(scheduleWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const shiftsByDate = {};
  shifts.forEach((s) => {
    const dateStr = format(parseISO(s.date), "yyyy-MM-dd");
    if (!shiftsByDate[dateStr]) shiftsByDate[dateStr] = [];
    shiftsByDate[dateStr].push(s);
  });

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-200 space-y-6">
      <h1 className="text-3xl font-bold mb-2">{`Welcome, ${employee.name}!`}</h1>
      <h2 className="text-xl mb-4">Today is {format(new Date(), "EEEE, MM/dd/yyyy")}</h2>

      {/* ---------------- Profile ---------------- */}
      <div className="bg-gray-800 rounded shadow p-4">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection("profile")}>
          <h2 className="text-2xl font-bold">Profile</h2>
          <span>{sectionsOpen.profile ? "▲" : "▼"}</span>
        </div>
        {sectionsOpen.profile && (
          <div className="mt-4">
            <EmployeeProfileForm employee={employee} setEmployee={setEmployee} editable={editingProfile} />
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className="mt-3 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded"
            >
              {editingProfile ? "Done Editing" : "Edit Profile"}
            </button>
          </div>
        )}
      </div>

      {/* ---------------- Attendance ---------------- */}
      <div className="bg-gray-800 rounded shadow p-4">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection("attendance")}>
          <h2 className="text-2xl font-bold">Attendance (Past 12 Months)</h2>
          <span>{sectionsOpen.attendance ? "▲" : "▼"}</span>
        </div>
        {sectionsOpen.attendance && (
          <div className="mt-4 flex gap-6 justify-center flex-wrap">
            <div
              className="bg-gray-700 p-6 rounded shadow text-center w-40 cursor-pointer hover:bg-gray-600 transition"
              onClick={() => setShowAttendanceModal(true)}
            >
              <div className="text-xl font-bold">{attendance.absences}</div>
              <div className="text-gray-400 mt-1">Absences</div>
            </div>
            <div
              className="bg-gray-700 p-6 rounded shadow text-center w-40 cursor-pointer hover:bg-gray-600 transition"
              onClick={() => setShowAttendanceModal(true)}
            >
              <div className="text-xl font-bold">{attendance.tardies}</div>
              <div className="text-gray-400 mt-1">Tardies</div>
            </div>
          </div>
        )}
      </div>

      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-800 p-6 rounded shadow w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Absences & Tardies (12 months)</h3>
              <button onClick={() => setShowAttendanceModal(false)} className="text-red-500 font-bold text-xl">×</button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {attendanceShifts.length === 0 && <p>No absences or tardies recorded.</p>}
              {attendanceShifts.map((s) => (
                <div key={s.id} className="p-2 bg-gray-700 rounded">
                  <div className="font-semibold">{s.status}</div>
                  <div className="text-sm">
                    {format(parseISO(s.date), "MMM d, yyyy")} | {s.start_time} - {s.end_time} | Location: {s.locations?.name || "N/A"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Weekly Schedule ---------------- */}
      <div className="bg-gray-800 rounded shadow p-4">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection("schedule")}>
          <h2 className="text-2xl font-bold">Weekly Schedule</h2>
          <span>{sectionsOpen.schedule ? "▲" : "▼"}</span>
        </div>
        {sectionsOpen.schedule && (
          <div className="mt-4">
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => changeWeek(-1)} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">◀ Prev</button>
              <button onClick={jumpToCurrentWeek} className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded">Current Week</button>
              <button onClick={() => changeWeek(1)} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Next ▶</button>
            </div>

            <div className="flex flex-col gap-2 md:grid md:grid-cols-7 md:gap-2">
              {weekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayShifts = shiftsByDate[dateStr] || [];

                return (
                  <div key={dateStr} className="bg-gray-700 p-2 rounded shadow min-h-[120px]">
                    <div className="font-semibold text-white mb-2">{format(day, "EEE MMM d")}</div>
                    {dayShifts.length > 0 ? dayShifts.map((s) => (
                      <div key={s.id} className="mb-1 p-1 rounded bg-gray-600 hover:bg-gray-500 transition text-xs sm:text-sm">
                        <div>Time: {s.start_time} - {s.end_time}</div>
                        <div>Role: {s.role}</div>
                        <div>Location: {s.locations?.name || "N/A"}</div>
                        <div className={`font-semibold ${s.status?.toLowerCase() === "tardy" ? "text-yellow-400" : s.status?.toLowerCase() === "absent" ? "text-red-400" : "text-green-400"}`}>
                          Status: {s.status || "Scheduled"}
                        </div>
                      </div>
                    )) : <div className="text-gray-400 text-sm text-center">No shifts</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Time-Off Request Form ---------------- */}
      <div className="bg-gray-800 rounded shadow p-4">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection("timeOffForm")}>
          <h2 className="text-2xl font-bold">Request Time Off</h2>
          <span>{sectionsOpen.timeOffForm ? "▲" : "▼"}</span>
        </div>
        {sectionsOpen.timeOffForm && (
          <form onSubmit={submitTimeOffRequest} className="mt-4 flex flex-col gap-3 max-w-md">
            <label>
              Start Date:
              <input type="date" value={newRequest.start_date} onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })} className="border p-2 rounded w-full bg-gray-700 text-gray-200" required />
            </label>
            <label>
              End Date:
              <input type="date" value={newRequest.end_date} onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })} className="border p-2 rounded w-full bg-gray-700 text-gray-200" required />
            </label>
            <label>
              Reason:
              <textarea value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} className="border p-2 rounded w-full bg-gray-700 text-gray-200" placeholder="Provide reason..." required />
            </label>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded">Submit Request</button>
          </form>
        )}
      </div>

      {/* ---------------- Time-Off Requests List ---------------- */}
      <div className="bg-gray-800 rounded shadow p-4">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSection("timeOffList")}>
          <h2 className="text-2xl font-bold">Your Time-Off Requests</h2>
          <span>{sectionsOpen.timeOffList ? "▲" : "▼"}</span>
        </div>
        {sectionsOpen.timeOffList && (
          <div className="mt-4 overflow-x-auto">
            {requestsLoading ? (
              <p>Loading requests...</p>
            ) : timeOffRequests.length > 0 ? (
              <table className="border-collapse border w-full text-left bg-gray-700 rounded">
                <thead>
                  <tr>
                    <th className="border p-2">Start</th>
                    <th className="border p-2">End</th>
                    <th className="border p-2">Reason</th>
                    <th className="border p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeOffRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-600">
                      <td className="border p-2">{format(parseISO(r.start_date), "MMM d, yyyy")}</td>
                      <td className="border p-2">{format(parseISO(r.end_date), "MMM d, yyyy")}</td>
                      <td className="border p-2">{r.reason}</td>
                      <td className="border p-2">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>No time-off requests submitted.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
