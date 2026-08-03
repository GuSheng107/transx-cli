import { writeFile } from "node:fs/promises";

function escapePdfText(value: string): string {
  return value.replace(/([\\()])/g, "\\$1");
}

export function createSimplePdf(text: string): Buffer {
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let position = chunks[0]?.length ?? 0;
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(position);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, "latin1");
    chunks.push(chunk);
    position += chunk.length;
  }
  const xrefPosition = position;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`,
  ].join("");
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

export async function writeSimplePdf(filePath: string, text: string): Promise<void> {
  await writeFile(filePath, createSimplePdf(text));
}
