import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { toFriendlyError } from "@/lib/errors";
import { createFolder } from "@/lib/files";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!getCurrentUserFromRequest(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      label?: string;
    };

    const folder = await createFolder(body.label || "");

    return NextResponse.json(folder);
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Falha ao criar pasta.") }, { status: 500 });
  }
}
