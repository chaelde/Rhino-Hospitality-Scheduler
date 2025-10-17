import { supabaseAdmin } from "@/lib/supabaseAdmin";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, phone, role, location_id } = body;

    if (!name || !email || !role || !location_id) {
      return new Response(JSON.stringify({ error: "Missing required fields." }), { status: 400 });
    }

    const TEMP_PASSWORD = "TempRHGpass!";

    // ✅ Create user and extract the nested user.id properly
    const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });
    if (userError) throw userError;

    const userId = data?.user?.id; // ✅ FIXED
    if (!userId) throw new Error("User creation succeeded but no ID returned.");

    // ✅ Insert employee record
    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .insert([
        {
          auth_id: userId,
          name,
          email,
          phone: phone || null,
          role,
          location_id,
          must_change_password: true,
        },
      ])
      .select()
      .single();
    if (empError) throw empError;

    // --- Send custom email ---
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const siteUrl =
      process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

    await transporter.sendMail({
      from: `"Rhino Hospitality" <no-reply@rhino.com>`,
      to: email,
      subject: "Your Rhino Scheduler Account",
      html: `
        <h2>Welcome to Rhino Hospitality Group’s Scheduler</h2>
        <p>Hello ${name},</p>
        <p>Your account has been created. Use the temporary password below to log in:</p>
        <p><strong>Temporary Password: ${TEMP_PASSWORD}</strong></p>
        <p>After logging in, you will be required to change your password.</p>
        <p><a href="${siteUrl}/login" style="background-color: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Login Now</a></p>
        <p>If you did not expect this email, ignore it.</p>
      `,
    });

    return new Response(JSON.stringify({ message: "Employee created and email sent.", employee }), { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
