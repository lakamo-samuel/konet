import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { DomainError } from "../../common/errors/domain.error";
export interface CloudinaryAsset {
  public_id: string;
  asset_id: string;
  version: number;
  bytes: number;
  format: string;
  resource_type: string;
  type: string;
}
@Injectable()
export class CloudinaryGateway {
  constructor(private config: ConfigService) {}
  configured(): boolean {
    return Boolean(
      this.config.get("CLOUDINARY_CLOUD_NAME") &&
      this.config.get("CLOUDINARY_API_KEY") &&
      this.config.get("CLOUDINARY_API_SECRET"),
    );
  }
  requireConfigured(): void {
    if (!this.configured())
      throw new DomainError(
        "STORAGE_NOT_CONFIGURED",
        "Cloudinary storage is not configured.",
        503,
      );
  }
  private options() {
    return {
      cloud_name: this.config.getOrThrow<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.config.getOrThrow<string>("CLOUDINARY_API_KEY"),
      api_secret: this.config.getOrThrow<string>("CLOUDINARY_API_SECRET"),
      timeout: 10000,
      secure: true,
    };
  }
  ticket(publicId: string) {
    this.requireConfigured();
    const params = {
      timestamp: Math.floor(Date.now() / 1000),
      public_id: publicId,
      type: "authenticated",
      overwrite: false,
      allowed_formats: "jpg,jpeg,png,pdf",
    };
    const fields: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ),
      api_key: this.options().api_key,
      signature: cloudinary.utils.api_sign_request(
        params,
        this.options().api_secret,
      ),
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.options().cloud_name}/image/upload`,
      method: "POST" as const,
      headers: {},
      fields,
    };
  }
  avatarTicket(publicId: string) {
    return this.publicImageTicket(publicId);
  }
  providerCoverTicket(publicId: string) {
    return this.publicImageTicket(publicId);
  }
  private publicImageTicket(publicId: string) {
    this.requireConfigured();
    const params = {
      timestamp: Math.floor(Date.now() / 1000),
      public_id: publicId,
      type: "upload",
      overwrite: false,
      allowed_formats: "jpg,jpeg,png,webp",
    };
    const options = this.options();
    const fields: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ),
      api_key: options.api_key,
      signature: cloudinary.utils.api_sign_request(
        params,
        options.api_secret,
      ),
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${options.cloud_name}/image/upload`,
      method: "POST" as const,
      fields,
    };
  }
  portfolioImageTicket(publicId: string) {
    return this.publicImageTicket(publicId);
  }
  async inspect(publicId: string): Promise<CloudinaryAsset> {
    this.requireConfigured();
    try {
      return (await cloudinary.api.resource(publicId, {
        ...this.options(),
        resource_type: "image",
        type: "authenticated",
      })) as CloudinaryAsset;
    } catch (error) {
      const status = error as {
        error?: { http_code?: number };
        http_code?: number;
      };
      if ((status.http_code ?? status.error?.http_code) === 404)
        throw new DomainError(
          "UPLOAD_NOT_FOUND_AT_PROVIDER",
          "Upload the file before completing this ticket.",
          409,
        );
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Unable to verify the upload with Cloudinary.",
        503,
      );
    }
  }
  async inspectPublicImage(publicId: string): Promise<CloudinaryAsset> {
    this.requireConfigured();
    try {
      return (await cloudinary.api.resource(publicId, {
        ...this.options(),
        resource_type: "image",
        type: "upload",
      })) as CloudinaryAsset;
    } catch (error) {
      const status = error as {
        error?: { http_code?: number };
        http_code?: number;
      };
      if ((status.http_code ?? status.error?.http_code) === 404)
        throw new DomainError(
          "UPLOAD_NOT_FOUND_AT_PROVIDER",
          "Upload the image before completing this ticket.",
          409,
        );
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Unable to verify the image with Cloudinary.",
        503,
      );
    }
  }
  inspectAvatar(publicId: string): Promise<CloudinaryAsset> {
    return this.inspectPublicImage(publicId);
  }
  avatarUrl(publicId: string, version: number): string {
    this.requireConfigured();
    return cloudinary.url(publicId, {
      ...this.options(),
      resource_type: "image",
      type: "upload",
      version,
      secure: true,
      transformation: [
        { width: 512, height: 512, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }
  providerCoverUrl(publicId: string, version: number): string {
    this.requireConfigured();
    return cloudinary.url(publicId, {
      ...this.options(),
      resource_type: "image",
      type: "upload",
      version,
      secure: true,
      transformation: [
        { width: 1600, height: 900, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }
  portfolioImageUrl(publicId: string, version: number): string {
    this.requireConfigured();
    return cloudinary.url(publicId, {
      ...this.options(),
      resource_type: "image",
      type: "upload",
      version,
      secure: true,
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });
  }
  download(publicId: string, format: string) {
    this.requireConfigured();
    const expiresAt = new Date(Date.now() + 300000);
    return {
      downloadUrl: cloudinary.utils.private_download_url(publicId, format, {
        ...this.options(),
        resource_type: "image",
        type: "authenticated",
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        attachment: true,
      }),
      expiresAt,
    };
  }
  async destroy(publicId: string): Promise<void> {
    if (!this.configured())
      throw new DomainError(
        "STORAGE_NOT_CONFIGURED",
        "Cloudinary storage is not configured.",
        503,
      );
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        ...this.options(),
        resource_type: "image",
        type: "authenticated",
        invalidate: true,
      });
      if (!["ok", "not found"].includes(result.result))
        throw new Error("Delete failed");
    } catch {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Cloudinary deletion is unavailable; retry later.",
        503,
      );
    }
  }
}
