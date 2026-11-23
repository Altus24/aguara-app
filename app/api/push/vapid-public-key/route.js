import { NextResponse } from "next/server";

import { getVapidPublicKey } from "@/lib/chapitas/webPush";

export async function GET() {
  try {
    return NextResponse.json({ publicKey: getVapidPublicKey() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "vapid_no_configurado" },
      { status: 503 },
    );
  }
}
