import type { ImageMeta } from "./content";

export async function inspectImage(file: File): Promise<ImageMeta> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size < 1 || file.size > 15_000_000) throw new Error("Use a PNG, JPEG or WebP image under 15 MB.");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image inspection is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const counts = new Map<string,number>();
    const pixels = context.getImageData(0,0,canvas.width,canvas.height).data;
    for (let i = 0; i < pixels.length; i += 16) {
      if (pixels[i+3] < 128) continue;
      const bucket = [0,1,2].map(c => Math.min(255, Math.round(pixels[i+c] / 32) * 32).toString(16).padStart(2,"0")).join("");
      counts.set(bucket,(counts.get(bucket) ?? 0)+1);
    }
    const dominantColor = counts.size ? `#${[...counts].sort((a,b) => b[1]-a[1])[0][0]}` : null;
    let previewDataUrl: string | null = null;
    for (const dimension of [256,192,128]) {
      const ratio = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1,Math.round(bitmap.width * ratio)); canvas.height = Math.max(1,Math.round(bitmap.height * ratio));
      canvas.getContext("2d")?.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const candidate = canvas.toDataURL("image/webp",0.6);
      if (candidate.length <= 64_000 && candidate.startsWith("data:image/webp;base64,")) { previewDataUrl = candidate; break; }
    }
    return { name: file.name.slice(0,200), mime: file.type as ImageMeta["mime"], bytes: file.size, sha256, alt: "", decorative: false, visualType: "brand-graphic", dominantColor, previewDataUrl };
  } finally { bitmap.close(); }
}
