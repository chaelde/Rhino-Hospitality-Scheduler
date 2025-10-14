import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

export async function POST(req) {
  try {
    const { location_id, week_start } = await req.json();

    if (!location_id || !week_start) {
      return new Response(JSON.stringify({ error: "Missing location_id or week_start" }), { status: 400 });
    }

    // 1️⃣ Mark all shifts for that week & location as published
    const { error: updateError } = await supabase
      .from("shifts")
      .update({ published: true })
      .eq("location_id", location_id)
      .eq("week_start", week_start);

    if (updateError) throw updateError;

    // 2️⃣ Fetch location name
    const { data: locationData, error: locError } = await supabase
      .from("locations")
      .select("name")
      .eq("id", location_id)
      .single();
    if (locError || !locationData) throw new Error("Location not found");
    const locationName = locationData.name;

    // Format week_start as MM-dd-yyyy
    const formattedWeekStart = format(new Date(week_start), "MM-dd-yyyy");

    // 3️⃣ Fetch all employees and filter by location
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, name, email, location_id, employee_locations(location_id)");
    if (empError) throw empError;

    const eligibleEmployees = employees.filter(emp => {
      const direct = emp.location_id === location_id;
      const multi = emp.employee_locations?.some(loc => loc.location_id === location_id);
      return (direct || multi) && emp.email && emp.email.includes("@");
    });

    if (eligibleEmployees.length === 0) {
      return new Response(JSON.stringify({ message: "No employees to notify." }), { status: 200 });
    }

    // 4️⃣ Send emails
    const failedEmails = [];

    for (const emp of eligibleEmployees) {
      try {
        const fullUrl = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || "http://localhost:3000"}/api/send-email`;
        const res = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: emp.email,
            subject: "Schedule Published",
            html: `
              <p>Hi ${emp.name || "Team Member"},</p>
              <p>Your schedule for the week starting <strong>${formattedWeekStart}</strong> at location <strong>${locationName}</strong> has been published!</p>
              <p>Please log in to the scheduler to view your shifts.</p>
              <p>– Rhino Hospitality Group</p>
            `,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || res.statusText);
        }
      } catch (err) {
        console.error(`Failed to send email to ${emp.email}:`, err.message);
        failedEmails.push(emp.email);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Schedule published successfully.",
        notified: eligibleEmployees.length - failedEmails.length,
        failed: failedEmails,
      }),
      { status: 200 }
    );

  } catch (err) {
    console.error("Error publishing schedule:", err.message || err);
    return new Response(JSON.stringify({ error: err.message || err.toString() }), { status: 500 });
  }
}
