import { supabase } from "@/lib/supabaseClient";

export async function POST(req) {
  try {
    const { request_id, new_status } = await req.json();
    if (!request_id || !new_status)
      return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });

    // 1️⃣ Fetch the request and employee info
    const { data: request, error: requestError } = await supabase
      .from("time_off_requests")
      .select("employee_id, location_id, start_date, end_date")
      .eq("id", request_id)
      .single();
    if (requestError || !request) throw new Error("Request not found");

    const { employee_id, location_id, start_date, end_date } = request;

    // 2️⃣ Get employee info
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("name, email")
      .eq("id", employee_id)
      .contains("location_ids", [location_id])
      .single();
    if (empError || !employee) throw new Error("Employee not found");

    // 3️⃣ Update time-off request status
    const { error: updateError } = await supabase
      .from("time_off_requests")
      .update({ status: new_status })
      .eq("id", request_id);
    if (updateError) throw updateError;

    // 4️⃣ Send email using the /api/send-email route
    const subject = `Time-Off Request ${new_status}`;
    const html = `
      <p>Hi ${employee.name},</p>
      <p>Your time-off request from <strong>${start_date}</strong> to <strong>${end_date}</strong> has been <strong>${new_status}</strong>.</p>
      <p>Please check the Scheduler app for details.</p>
      <p>– Rhino Hospitality Group</p>
    `;

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: employee.email,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error("Email API failed: " + errText);
    }

    return new Response(JSON.stringify({ message: "Employee notified" }), { status: 200 });
  } catch (err) {
    console.error("Error sending time-off status email:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
