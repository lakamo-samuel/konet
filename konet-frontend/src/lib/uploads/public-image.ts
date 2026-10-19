import type { AvatarUploadTicket } from "@/types/account-settings";

const maxImageBytes = 5 * 1024 * 1024;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

export async function uploadPublicImage(
  file: File,
  signal: AbortSignal,
  createTicket: (input: { contentType: string; sizeBytes: number }) => Promise<AvatarUploadTicket>,
  completeTicket: (publicId: string) => Promise<string>,
): Promise<string> {
  if (
    !allowedTypes.includes(file.type) ||
    file.size < 1 ||
    file.size > maxImageBytes
  )
    throw new Error("Choose a JPEG, PNG or WebP image up to 5 MiB.");

  const ticket = await createTicket({
    contentType: file.type,
    sizeBytes: file.size,
  });
  const target = new URL(ticket.uploadUrl);
  if (
    target.protocol !== "https:" ||
    target.hostname !== "api.cloudinary.com" ||
    target.username ||
    target.password ||
    ticket.method !== "POST"
  )
    throw new Error("The image upload service returned an invalid destination.");

  const body = new FormData();
  for (const [key, value] of Object.entries(ticket.fields)) body.append(key, value);
  body.append("file", file);
  const response = await fetch(target, {
    method: "POST",
    body,
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
  });
  if (!response.ok) {
    let message = "";
    try {
      const payload: unknown = await response.json();
      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error &&
        typeof payload.error === "object" &&
        "message" in payload.error &&
        typeof payload.error.message === "string"
      )
        message = payload.error.message.replace(/[\r\n\t]+/g, " ").slice(0, 240);
    } catch {
      // Cloudinary can return a non-JSON response for upstream failures.
    }
    throw new Error(
      message
        ? `Image upload failed (${response.status}): ${message}`
        : `Image upload failed (HTTP ${response.status}). Check the image and upload service configuration, then try again.`,
    );
  }
  return completeTicket(ticket.publicId);
}
