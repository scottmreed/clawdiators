import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export async function GET() {
  try {
    const res = await apiFetch<unknown[]>("/api/v1/leaderboard");
    if (res.ok) {
      return NextResponse.json({ ok: true, data: res.data });
    }
    return NextResponse.json({ ok: false, data: [] }, { status: 502 });
  } catch {
    return NextResponse.json({ ok: false, data: [], error: "API unavailable" }, { status: 502 });
  }
}
