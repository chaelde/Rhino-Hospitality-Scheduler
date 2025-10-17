import { supabaseAdmin } from "@/lib/supabaseAdmin";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
    }

    // Get user from Supabase
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) throw userError;

    const user = users?.users?.find((u) => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

    // Email setup
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send reset email
    await transporter.sendMail({
      from: `"Rhino Hospitality" <no-reply@rhino.com>`,
      to: email,
      subject: "Reset Your Rhino Scheduler Password",
      html: `
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your Rhino Scheduler password.</p>
        <p>Click the button below to create a new password:</p>
        <p><a href="${siteUrl}/force-change-password?user_id=${user.id}" style="background-color: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reset Password</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });

    return new Response(JSON.stringify({ message: "Reset email sent successfully" }), { status: 200 });
  } catch (err) {
    console.error("Error sending reset email:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
