import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, phone, role, location_id } = body;

    // Validate required fields
    if (!name || !email || !role || !location_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400 }
      );
    }

    // Validate location_id format (UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(location_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid location_id." }),
        { status: 400 }
      );
    }

    // ✅ Step 1: Invite user (send Supabase invite email)
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const redirectTo = `${baseUrl}/set-password`;

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (inviteError) {
      console.error("Error sending invite:", inviteError);
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400 }
      );
    }

    const userId = inviteData?.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User creation failed — no ID returned." }),
        { status: 500 }
      );
    }

    // ✅ Step 2: Insert employee record
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
        },
      ])
      .select()
      .single();

    if (empError) {
      console.error("Error inserting employee:", empError);
      return new Response(
        JSON.stringify({ error: empError.message }),
        { status: 400 }
      );
    }

    // ✅ Step 3: Return success
    return new Response(
      JSON.stringify({
        message:
          "Employee invited successfully. Email sent for account setup.",
        employee,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
}
