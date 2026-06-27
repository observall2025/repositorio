import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { toFriendlyError } from "@/lib/errors";
import { toToken } from "@/lib/links";
import { createSignedDocumentUpload } from "@/lib/files";

export const runtime = "nodejs";

function getRequestBaseUrl(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");

  return `${protocol}://${host}`;
}

export async function POST(request: NextRequest) {
  if (!getCurrentUserFromRequest(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      fileName?: string;
      fileSize?: number;
    };

    if (!body.fileName || typeof body.fileSize !== "number") {
      return NextResponse.json({ error: "Arquivo nao informado." }, { status: 400 });
    }

    const uploaded = await createSignedDocumentUpload(body.fileName, body.fileSize);
    const viewerUrl = `${getRequestBaseUrl(request)}/view/${toToken(uploaded.path)}`;

    return NextResponse.json({
      path: uploaded.path,
      signedUrl: uploaded.signedUrl,
      publicUrl: uploaded.publicUrl,
      viewerUrl
    });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Falha ao enviar arquivo.") }, { status: 500 });
  }
}
