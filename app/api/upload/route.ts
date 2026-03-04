/* app/api/upload/route.ts */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kaimbtcuyemwzvhsqwgu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  try {
    // Check service key
    if (!SUPABASE_SERVICE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("session_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("Upload request:", { 
      name: file.name, 
      type: file.type, 
      size: file.size,
      sessionId 
    });

    // Check file size (max 4MB to stay under Vercel limit)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Foto is te groot (max 4MB). Kies een kleinere foto." }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const ext = (file.name.split(".").pop()?.toLowerCase()) || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext) ? ext : "jpg";
    const filePath = `sessions/${sessionId || "unknown"}_${Date.now()}.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("Uploading to Supabase storage:", filePath);

    const { data, error } = await supabase.storage
      .from("session-photos")
      .upload(filePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Supabase storage error:", JSON.stringify(error));
      return NextResponse.json({ 
        error: `Storage fout: ${error.message}`,
        details: error 
      }, { status: 500 });
    }

    console.log("Upload success:", data);

    const { data: urlData } = supabase.storage
      .from("session-photos")
      .getPublicUrl(filePath);

    console.log("Public URL:", urlData.publicUrl);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e: any) {
    console.error("Upload route exception:", e);
    return NextResponse.json({ error: e.message || "Onbekende fout" }, { status: 500 });
  }
}