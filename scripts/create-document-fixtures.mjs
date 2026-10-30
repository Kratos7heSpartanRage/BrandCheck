import { mkdir, writeFile } from "node:fs/promises";
await mkdir("work/shared-tests", { recursive: true });
// Minimal real two-page PDF for exercising PDF.js extraction and page links.
const strings = ["NovaDesk is designed to simplify daily work.", "Flowly guarantees 2x productivity for every team."];
const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>"];
for (const [index, text] of strings.entries()) {
  const stream = `BT /F1 16 Tf 40 750 Td (${text}) Tj ET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents ${index === 0 ? 4 : 6} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
}
objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
let pdf = "%PDF-1.4\n"; const offsets = [0];
for (const [index, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const start = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
await writeFile("work/shared-tests/sample.pdf", pdf);
console.log("Created work/shared-tests/sample.pdf");
