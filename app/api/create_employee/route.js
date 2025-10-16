// pages/api/create-employee.js
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { v4 as uuidv4 } from "uuid";

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, phone, role, location_id } = body;

    if (!name || !email || !role || !location_id)
      return new Response(JSON.stringify({ error: "Missing required fields." }), { status: 400 });

    // Create user in Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "temporary-password-123!", // temporary placeholder
      email_confirm: true,
    });

    if (userError) throw userError;
    const userId = userData?.id;

    // Insert employee record
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .insert([{ auth_id: userId, name, email, phone: phone || null, role, location_id }])
      .select()
      .single();

    if (empError) throw empError;

    // Generate custom token
    const token = uuidv4();
    const { error: tokenError } = await supabaseAdmin
      .from("password_tokens")
      .insert([{ auth_id: userId, token, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) }]); // 24h expiry

    if (tokenError) throw tokenError;

    // Send custom email
    const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://rhino-hospitality-scheduler.vercel.app";
    const passwordLink = `${siteUrl}/set-password?token=${token}`;
    await sendEmail(email, name, passwordLink); // implement sendEmail separately

    return new Response(JSON.stringify({ message: "Employee created and email sent.", employee }), {
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
