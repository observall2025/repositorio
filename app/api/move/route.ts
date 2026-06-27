import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { toFriendlyError } from "@/lib/errors";
import { moveDocumentToFolder } from "@/lib/files";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!getCurrentUserFromRequest(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      path?: string;
      folder?: string;
    };

    if (!body.path || !body.folder) {
      return NextResponse.json({ error: "Arquivo e pasta de destino sao obrigatorios." }, { status: 400 });
    }

    const path = await moveDocumentToFolder(body.path, body.folder);

    return NextResponse.json({ path });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Falha ao mover arquivo.") }, { status: 500 });
  }
}
