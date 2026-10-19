import { command } from "@/data/access/client";
import { uploadPublicImage } from "./public-image";

export function uploadPortfolioImage(
  file: File,
  signal: AbortSignal,
): Promise<string> {
  return uploadPublicImage(
    file,
    signal,
    (input) => command("createPortfolioImageUpload", input),
    async (publicId) => {
      const result = await command("completePortfolioImageUpload", {
        publicId,
      });
      return result.assetUrl;
    },
  );
}
