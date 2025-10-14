import { supabase } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/sendEmail";

export async function POST(req) {
  try {
    const { request_id, new_status } = await req.json();
    if (!request_id || !new_status) 
      return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });

    // 1️⃣ Fetch the time-off request
    const { data: request } = await supabase
      .from("time_off_requests")
      .select("employee_auth_id,start_date,end_date")
      .eq("id", request_id)
      .single();

    if (!request) throw new Error("Request not found");

    const { employee_auth_id, start_date, end_date } = request;

    // 2️⃣ Fetch the employee by auth_id (simpler lookup)
    const { data: employee } = await supabase
      .from("employees")
      .select("name,email")
      .eq("auth_id", employee_auth_id)
      .single();

    if (!employee) throw new Error("Employee not found");

    // 3️⃣ Send email
    const subject = `Time-Off Request ${new_status}`;
    const html = `
      <p>Hi ${employee.name},</p>
      <p>Your time-off request from <strong>${start_date}</strong> to <strong>${end_date}</strong> has been <strong>${new_status}</strong>.</p>
      <p>Check the app for details.</p>
    `;
    await sendEmail(employee.email, subject, html);

    return new Response(JSON.stringify({ message: "Employee notified" }), { status: 200 });
  } catch (err) {
    console.error("Error sending time-off status email:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
