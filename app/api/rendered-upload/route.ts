import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { createSignedRenderedPageUpload } from "@/lib/files";
import { toFriendlyError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!getCurrentUserFromRequest(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      sourcePath?: string;
      page?: number;
      fileSize?: number;
    };

    if (!body.sourcePath || typeof body.page !== "number" || typeof body.fileSize !== "number") {
      return NextResponse.json({ error: "Pagina renderizada nao informada." }, { status: 400 });
    }

    const upload = await createSignedRenderedPageUpload(body.sourcePath, body.page, body.fileSize);

    return NextResponse.json(upload);
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Falha ao preparar pagina renderizada.") }, { status: 500 });
  }
}
