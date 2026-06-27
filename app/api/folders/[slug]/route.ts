import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { toFriendlyError } from "@/lib/errors";
import { deleteFolder, renameFolder } from "@/lib/files";

export const runtime = "nodejs";

type FolderRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: FolderRouteProps) {
  if (!getCurrentUserFromRequest(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const { slug } = await params;
    const body = (await request.json()) as {
      label?: string;
    };
    const folder = await renameFolder(slug, body.label || "");

    return NextResponse.json(folder);
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Falha ao renomear pasta.") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: FolderRouteProps) {
  if (!getCurrentUserFromRequest(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const { slug } = await params;

    await deleteFolder(slug);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Falha ao excluir pasta.") }, { status: 500 });
  }
}
