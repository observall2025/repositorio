"use client";

type RenderProgress = {
  page: number;
  total: number;
};

type RenderedUploadResponse = {
  error?: string;
  signedUrl?: string;
};

async function uploadToSignedUrl(signedUrl: string, file: File) {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);

  const response = await fetch(signedUrl, {
    method: "PUT",
    body
  });

  if (!response.ok) {
    let detail = `Falha no upload renderizado (${response.status}).`;

    try {
      const data = (await response.json()) as { error?: string; message?: string };
      detail = data.error || data.message || detail;
    } catch {
      // Storage can return plain text.
    }

    throw new Error(detail);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Pagina renderizada vazia."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      0.82
    );
  });
}

async function createSignedRenderedUpload(sourcePath: string, page: number, fileSize: number) {
  const response = await fetch("/api/rendered-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sourcePath,
      page,
      fileSize
    })
  });
  const data = (await response.json()) as RenderedUploadResponse;

  if (!response.ok) {
    throw new Error(data.error || "Falha ao preparar pagina renderizada.");
  }

  if (!data.signedUrl) {
    throw new Error("URL de upload renderizado nao gerada.");
  }

  return data.signedUrl;
}

export function canRenderPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export async function renderPdfToStorage(
  sourcePath: string,
  file: File,
  onProgress?: (progress: RenderProgress) => void
) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1440 / baseViewport.width, 2);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Nao foi possivel preparar a renderizacao.");
    }

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport
    }).promise;

    const blob = await canvasToBlob(canvas);
    const renderedFile = new File([blob], `page-${String(pageNumber).padStart(3, "0")}.jpg`, {
      type: "image/jpeg"
    });
    const signedUrl = await createSignedRenderedUpload(sourcePath, pageNumber, renderedFile.size);

    await uploadToSignedUrl(signedUrl, renderedFile);
    onProgress?.({
      page: pageNumber,
      total: pdf.numPages
    });
  }

  return pdf.numPages;
}
