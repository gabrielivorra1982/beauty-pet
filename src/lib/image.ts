/**
 * Compresión de imagen en el cliente para reducir latencia y coste antes
 * de subir al bucket. Best-effort: si algo falla (HEIC no decodificable,
 * navegador sin soporte, OOM, etc.) devuelve el archivo ORIGINAL para
 * no bloquear nunca la subida.
 */

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File | Blob): Promise<Blob> {
  try {
    if (typeof window === "undefined") return file;
    // Si no es imagen, no toques nada.
    const type = (file as File).type ?? "";
    if (!type.startsWith("image/")) return file;

    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height) {
      release(bitmap);
      return file;
    }

    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(targetW, targetH)
        : Object.assign(document.createElement("canvas"), {
            width: targetW,
            height: targetH,
          });

    const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) {
      release(bitmap);
      return file;
    }
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, targetW, targetH);
    release(bitmap);

    let blob: Blob | null = null;
    if ("convertToBlob" in canvas) {
      blob = await (canvas as OffscreenCanvas).convertToBlob({
        type: "image/jpeg",
        quality: JPEG_QUALITY,
      });
    } else {
      blob = await new Promise<Blob | null>((resolve) =>
        (canvas as HTMLCanvasElement).toBlob(
          (b) => resolve(b),
          "image/jpeg",
          JPEG_QUALITY,
        ),
      );
    }
    if (!blob) return file;
    // Si tras comprimir resulta más grande que el original, conserva el original.
    if (blob.size >= file.size) return file;
    return blob;
  } catch {
    return file;
  }
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function release(b: ImageBitmap | HTMLImageElement) {
  if (typeof ImageBitmap !== "undefined" && b instanceof ImageBitmap) {
    b.close();
  }
}
