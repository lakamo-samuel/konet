import { command } from "@/data/access/client";
import type { PrivateUpload } from "@/types/verification";
export const maxEvidenceBytes = 10 * 1024 * 1024;
export async function uploadPrivateFile(
  file: File,
  purpose: "student_evidence" | "provider_evidence",
  signal: AbortSignal,
  onTicket: (upload: PrivateUpload) => void,
): Promise<PrivateUpload> {
  if (
    !["image/jpeg", "image/png", "application/pdf"].includes(file.type) ||
    file.size < 1 ||
    file.size > maxEvidenceBytes
  )
    throw new Error("Choose a JPEG, PNG or PDF file up to 10 MiB.");
  const ticket = await command("createUpload", {
    purpose,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  onTicket(ticket.upload);
  const target = new URL(ticket.uploadUrl);
  if (
    target.protocol !== "https:" ||
    target.hostname !== "api.cloudinary.com" ||
    target.username ||
    target.password ||
    ticket.method !== "POST"
  )
    throw new Error(
      "The document upload service returned an invalid destination.",
    );
  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.fields))
    form.append(key, value);
  form.append("file", file);
  // Do not use the authenticated API client here: Cloudinary must not receive Konet credentials.
  const response = await fetch(target, {
    method: "POST",
    body: form,
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
  });
  if (!response.ok)
    throw new Error(
      "Document upload failed. Remove the document and try again.",
    );
  return ticket.upload;
}
