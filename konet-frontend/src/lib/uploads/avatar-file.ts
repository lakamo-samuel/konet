import { command } from "@/data/access/client";
import { uploadPublicImage } from "./public-image";

export function uploadAvatar(file: File, signal: AbortSignal): Promise<string> {
  return uploadPublicImage(
    file,
    signal,
    (input) => command("createAvatarUpload", input),
    async (publicId) => {
      const result = await command("completeAvatarUpload", { publicId });
      return result.avatarUrl;
    },
  );
}
