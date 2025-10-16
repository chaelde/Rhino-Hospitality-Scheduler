// pages/api/verify-token.js
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  try {
    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: "Token missing" }), { status: 400 });

    // Find token
    const { data: tokenRow, error } = await supabaseAdmin
      .from("password_tokens")
      .select("auth_id, expires_at")
      .eq("token", token)
      .single();

    if (error || !tokenRow) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 400 });
    if (new Date(tokenRow.expires_at) < new Date()) return new Response(JSON.stringify({ error: "Token expired" }), { status: 400 });

    // Create session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: (await supabaseAdmin.from("employees").select("email").eq("auth_id", tokenRow.auth_id).single()).data.email,
      redirectTo: process.env.NEXT_PUBLIC_BASE_URL + "/set-password",
    });

    if (sessionError) throw sessionError;

    return new Response(JSON.stringify({ data: sessionData }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
