import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { toFriendlyError } from "@/lib/errors";
import { deleteDocument } from "@/lib/files";

export async function POST(request: NextRequest) {
  if (!getCurrentUserFromRequest(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { path?: string };

    if (!body.path?.startsWith("uploads/")) {
      return NextResponse.json({ error: "Arquivo invalido." }, { status: 400 });
    }

    await deleteDocument(body.path);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Falha ao excluir arquivo.") }, { status: 500 });
  }
}
