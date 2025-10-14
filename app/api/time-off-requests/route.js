import { supabase } from "@/lib/supabaseClient";

export async function POST(req) {
  try {
    const { request_id, new_status } = await req.json();
    if (!request_id || !new_status)
      return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });

    // 1️⃣ Fetch the time-off request
    const { data: request, error: reqError } = await supabase
      .from("time_off_requests")
      .select("employee_id, location_id, start_date, end_date")
      .eq("id", request_id)
      .single();

    if (reqError || !request) throw new Error("Request not found");

    const { employee_id, location_id, start_date, end_date } = request;

    // 2️⃣ Fetch the employee who belongs to that location
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("name, email")
      .eq("id", employee_id)
      .contains("location_ids", [location_id]) // optional if using join table
      .single();

    if (empError || !employee) throw new Error("Employee not found");

    // 3️⃣ Prepare email content
    const subject = `Time-Off Request ${new_status}`;
    const html = `
      <p>Hi ${employee.name},</p>
      <p>Your time-off request from <strong>${start_date}</strong> to <strong>${end_date}</strong> has been <strong>${new_status}</strong>.</p>
      <p>Check the app for details.</p>
    `;

    // 4️⃣ Send email using Supabase RPC / stored procedure as in publish-schedule
    const { error: emailError } = await supabase.rpc("send_email", {
      recipient_email: employee.email,
      email_subject: subject,
      email_html: html,
    });

    if (emailError) throw emailError;

    return new Response(JSON.stringify({ message: "Employee notified" }), { status: 200 });
  } catch (err) {
    console.error("Error sending time-off status email:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
