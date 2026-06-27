"use client";

type OptimizationKind = "pdf" | "office" | "image" | "unsupported";

export type FileOptimizationResult = {
  file: File;
  changed: boolean;
  originalSize: number;
  optimizedSize: number;
  kind: OptimizationKind;
  detail: string;
};

const IMAGE_MAX_SIDE = 1800;
const IMAGE_QUALITY = 0.78;
const PDF_IMAGE_MAX_SIDE = 2200;
const PDF_IMAGE_MAX_SCALE = 2.6;
const PDF_IMAGE_QUALITY = 0.84;
const MIN_SAVINGS_BYTES = 8 * 1024;
const MIN_SAVINGS_RATIO = 0.02;

const OFFICE_MIME_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function getExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function replaceExtension(name: string, extension: string) {
  const dot = name.lastIndexOf(".");
  const baseName = dot > 0 ? name.slice(0, dot) : name;

  return `${baseName}.${extension}`;
}

function blobFromBytes(bytes: Uint8Array, type: string) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(arrayBuffer).set(bytes);

  return new Blob([arrayBuffer], { type });
}

function hasMeaningfulSavings(originalSize: number, optimizedSize: number) {
  const savings = originalSize - optimizedSize;

  return savings > 0 && (savings >= MIN_SAVINGS_BYTES || savings / originalSize >= MIN_SAVINGS_RATIO);
}

function unchanged(file: File, kind: OptimizationKind, detail: string): FileOptimizationResult {
  return {
    file,
    changed: false,
    originalSize: file.size,
    optimizedSize: file.size,
    kind,
    detail
  };
}

function candidate(
  original: File,
  blob: Blob,
  fileName: string,
  kind: OptimizationKind,
  detail: string
): FileOptimizationResult {
  if (!hasMeaningfulSavings(original.size, blob.size)) {
    return unchanged(original, kind, "Arquivo mantido no tamanho original; nao houve reducao segura.");
  }

  return {
    file: new File([blob], fileName, {
      type: blob.type || original.type,
      lastModified: Date.now()
    }),
    changed: true,
    originalSize: original.size,
    optimizedSize: blob.size,
    kind,
    detail
  };
}

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isOfficeOpenXml(file: File) {
  return ["docx", "pptx", "xlsx"].includes(getExtension(file.name));
}

function isCanvasImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

async function optimizePdf(file: File): Promise<FileOptimizationResult> {
  const { PDFDocument, ParseSpeeds } = await import("pdf-lib");
  const input = await file.arrayBuffer();
  const pdf = await PDFDocument.load(input, {
    ignoreEncryption: true,
    parseSpeed: ParseSpeeds.Fastest,
    updateMetadata: false
  });
  const output = await pdf.save({
    addDefaultPage: false,
    updateFieldAppearances: false,
    useObjectStreams: true
  });
  const structural = candidate(file, blobFromBytes(output, "application/pdf"), file.name, "pdf", "PDF compactado antes do upload.");

  if (structural.changed) {
    return structural;
  }

  return optimizePdfAsImages(file);
}

async function optimizePdfAsImages(file: File): Promise<FileOptimizationResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { PDFDocument } = await import("pdf-lib");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const sourceDocument = await pdfjs.getDocument({
    data: sourceBytes,
    disableFontFace: true
  }).promise;
  const outputDocument = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= sourceDocument.numPages; pageNumber += 1) {
    const page = await sourceDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const renderScale = Math.min(PDF_IMAGE_MAX_SCALE, PDF_IMAGE_MAX_SIDE / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {
      alpha: false
    });

    if (!context) {
      await sourceDocument.cleanup();
      return unchanged(file, "pdf", "PDF enviado no tamanho original.");
    }

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport
    }).promise;

    const imageBlob = await canvasToBlob(canvas, "image/jpeg", PDF_IMAGE_QUALITY);
    canvas.width = 1;
    canvas.height = 1;

    if (!imageBlob) {
      await sourceDocument.cleanup();
      return unchanged(file, "pdf", "PDF enviado no tamanho original.");
    }

    const embeddedPage = await outputDocument.embedJpg(await imageBlob.arrayBuffer());
    const outputPage = outputDocument.addPage([baseViewport.width, baseViewport.height]);

    outputPage.drawImage(embeddedPage, {
      x: 0,
      y: 0,
      width: baseViewport.width,
      height: baseViewport.height
    });

    page.cleanup();
  }

  await sourceDocument.cleanup();

  const output = await outputDocument.save({
    addDefaultPage: false,
    useObjectStreams: true
  });

  return candidate(
    file,
    blobFromBytes(output, "application/pdf"),
    file.name,
    "pdf",
    "PDF compactado em modo imagem antes do upload."
  );
}

async function optimizeOfficeOpenXml(file: File): Promise<FileOptimizationResult> {
  const { unzipSync, zipSync } = await import("fflate");
  const input = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(input);
  const output = zipSync(entries, {
    level: 9
  });
  const extension = getExtension(file.name);
  const mimeType = file.type || OFFICE_MIME_TYPES[extension] || "application/octet-stream";

  return candidate(file, blobFromBytes(output, mimeType), file.name, "office", "Documento Office recomprimido antes do upload.");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function loadImage(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);

      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close()
      };
    } catch {
      // Fall back to HTMLImageElement decoding below.
    }
  }

  return new Promise<{
    source: CanvasImageSource;
    width: number;
    height: number;
    close: () => void;
  }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => undefined
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem invalida."));
    };
    image.src = url;
  });
}

async function optimizeImage(file: File): Promise<FileOptimizationResult> {
  const image = await loadImage(file);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    image.close();
    return unchanged(file, "image", "Imagem enviada no tamanho original.");
  }

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image.source, 0, 0, width, height);
  image.close();

  const webp = await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY);

  if (!webp) {
    return unchanged(file, "image", "Imagem enviada no tamanho original.");
  }

  return candidate(file, webp, replaceExtension(file.name, "webp"), "image", "Imagem otimizada antes do upload.");
}

export async function optimizeFileForStorage(file: File): Promise<FileOptimizationResult> {
  try {
    if (isPdf(file)) {
      return await optimizePdf(file);
    }

    if (isOfficeOpenXml(file)) {
      return await optimizeOfficeOpenXml(file);
    }

    if (isCanvasImage(file)) {
      return await optimizeImage(file);
    }
  } catch {
    const kind: OptimizationKind = isPdf(file) ? "pdf" : isOfficeOpenXml(file) ? "office" : isCanvasImage(file) ? "image" : "unsupported";

    return unchanged(file, kind, "Arquivo enviado no tamanho original; nao foi possivel compactar com seguranca.");
  }

  return unchanged(file, "unsupported", "Formato enviado no tamanho original.");
}
