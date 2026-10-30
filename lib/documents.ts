export type DocumentPart = { label: string; text: string };
export type ExtractedDocument = { name: string; parts: DocumentPart[]; warnings: string[] };

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.size > 5_000_000) throw new Error("Choose a file smaller than 5 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  let parts: DocumentPart[] = []; const warnings: string[] = [];
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    // Serve the upstream worker as a static file so dev tooling does not inject
    // browser-window overlays into a worker context.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker.mjs";
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 20) throw new Error("This demo supports PDFs up to 20 pages.");
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
        if (!text) warnings.push(`Page ${pageNumber} has no extractable text. Scanned images need OCR, which is not supported.`);
        parts.push({ label: `Page ${pageNumber}`, text }); page.cleanup();
      }
      await task.destroy();
    } catch (error) {
      await task.destroy();
      if (error instanceof Error && /password/i.test(error.message)) throw new Error("Password-protected PDFs are not supported. Use an unlocked copy.");
      throw error;
    }
  } else if (extension === "docx") {
    // Check expanded ZIP entry sizes before Mammoth decompresses the archive.
    const { unzipSync } = await import("fflate");
    let expanded = 0;
    unzipSync(new Uint8Array(await file.arrayBuffer()), { filter(entry) {
      expanded += entry.originalSize;
      if (expanded > 20_000_000 || entry.originalSize > 10_000_000) throw new Error("This DOCX expands beyond the safe import limit.");
      return false;
    } });
    const { default: mammoth } = await import("mammoth/mammoth.browser.js");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    parts = result.value.split(/\n\s*\n/).filter(text => text.trim()).map((text, index) => ({ label: `Paragraph ${index + 1}`, text: text.trim() }));
    if (result.messages.length) warnings.push("Some DOCX formatting or embedded objects could not be extracted. Review the extracted text before relying on findings.");
  } else if (extension === "txt" || extension === "md") {
    parts = (await file.text()).split(/\n\s*\n/).filter(text => text.trim()).map((text, index) => ({ label: `Paragraph ${index + 1}`, text: text.trim() }));
  } else throw new Error("Choose a PDF, DOCX, TXT or Markdown file.");
  if (!parts.some(part => part.text.trim())) throw new Error("No reviewable text was extracted. Scanned documents require OCR, which is not available here.");
  if (parts.reduce((n, part) => n + part.text.length, 0) > 40_000) throw new Error("Extracted text exceeds 40,000 characters. Import a shorter document.");
  if (parts.length > 200) throw new Error("This demo supports up to 200 paragraphs.");
  return { name: file.name, parts, warnings };
}
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("Use a six-digit hex colour.");
    const values = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
