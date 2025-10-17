import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  try {
    const { user_id, password } = await req.json();

    if (!user_id || !password) {
      return new Response(JSON.stringify({ error: "Missing user_id or password" }), { status: 400 });
    }

    // Update the password securely via admin client
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
    if (error) throw error;

    // Clear the "must_change_password" flag
    const { error: empError } = await supabaseAdmin
      .from("employees")
      .update({ must_change_password: false })
      .eq("auth_id", user_id);
    if (empError) throw empError;

    return new Response(JSON.stringify({ message: "Password updated successfully" }), { status: 200 });
  } catch (err) {
    console.error("Error updating password:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
