import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryGateway } from "../src/modules/uploads/cloudinary.gateway";
import { validateEnvironment } from "../src/config/env";
describe("private Cloudinary gateway", () => {
  const values = {
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-key",
    CLOUDINARY_API_SECRET: "test-secret",
  };
  it("accepts empty integration placeholders while retaining required secret validation", () => {
    const base = {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test.invalid/test",
      FRONTEND_URL: "http://localhost:3000",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      EMAIL_OUTBOX_KEY: "",
      PASSWORD_RESET_URL: "",
      CLOUDINARY_CLOUD_NAME: "",
      CLOUDINARY_API_KEY: "",
      CLOUDINARY_API_SECRET: "",
    };
    const env = validateEnvironment(base);
    expect(env.EMAIL_FROM).toBeUndefined();
    expect(env.CLOUDINARY_CLOUD_NAME).toBeUndefined();
    expect(() =>
      validateEnvironment({ ...base, JWT_ACCESS_SECRET: "" }),
    ).toThrow();
  });
  afterEach(() => jest.restoreAllMocks());
  it("signs private non-overwriting uploads and excludes the API secret from the frontend ticket", () => {
    const gateway = new CloudinaryGateway(new ConfigService(values));
    const ticket = gateway.ticket("konet/student-evidence/owner/upload");
    expect(ticket.uploadUrl).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
    );
    expect(ticket.method).toBe("POST");
    expect(ticket.fields.type).toBe("authenticated");
    expect(ticket.fields.overwrite).toBe("false");
    expect(ticket.fields).not.toHaveProperty("moderation");
    expect(JSON.stringify(ticket)).not.toContain("test-secret");
    const { api_key, signature, ...params } = ticket.fields;
    expect(api_key).toBe("test-key");
    expect(signature).toBe(
      cloudinary.utils.api_sign_request(params, "test-secret"),
    );
  });
  it("signs public profile image uploads without exposing the API secret", () => {
    const gateway = new CloudinaryGateway(new ConfigService(values));
    const ticket = gateway.avatarTicket(
      "konet/avatars/owner/00000000-0000-4000-8000-000000000001",
    );
    expect(ticket.uploadUrl).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
    );
    expect(ticket.method).toBe("POST");
    expect(ticket.fields.type).toBe("upload");
    expect(ticket.fields.overwrite).toBe("false");
    expect(ticket.fields.allowed_formats).toBe("jpg,jpeg,png,webp");
    const { api_key, signature, ...params } = ticket.fields;
    expect(api_key).toBe("test-key");
    expect(signature).toBe(
      cloudinary.utils.api_sign_request(params, "test-secret"),
    );
    expect(JSON.stringify(ticket)).not.toContain("test-secret");
  });
  it("inspects profile images as public assets and creates optimized HTTPS URLs", async () => {
    const resource = jest
      .spyOn(cloudinary.api, "resource")
      .mockResolvedValue({
        public_id: "konet/avatars/owner/image",
      } as any);
    const gateway = new CloudinaryGateway(new ConfigService(values));
    await expect(gateway.inspectAvatar("konet/avatars/owner/image")).resolves
      .toMatchObject({
        public_id: "konet/avatars/owner/image",
      });
    expect(resource).toHaveBeenCalledWith(
      "konet/avatars/owner/image",
      expect.objectContaining({ type: "upload", resource_type: "image" }),
    );
    const url = new URL(
      gateway.avatarUrl("konet/avatars/owner/image", 123),
    );
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("res.cloudinary.com");
    expect(url.pathname).toContain("/c_fill");
    expect(url.pathname).toContain("/v123/");
  });
  it("requires storage credentials without requesting paid moderation", () => {
    expect(() =>
      new CloudinaryGateway(new ConfigService({})).ticket("key"),
    ).toThrow("Cloudinary storage is not configured");
    const ticket = new CloudinaryGateway(
      new ConfigService(values),
    ).ticket("key");
    expect(ticket.fields).not.toHaveProperty("moderation");
  });
  it("reads authoritative private metadata and reports provider errors without exposing them", async () => {
    const resource = jest
      .spyOn(cloudinary.api, "resource")
      .mockResolvedValue({ public_id: "key" } as any);
    const gateway = new CloudinaryGateway(new ConfigService(values));
    await expect(gateway.inspect("key")).resolves.toMatchObject({
      public_id: "key",
    });
    expect(resource).toHaveBeenCalledWith(
      "key",
      expect.objectContaining({
        type: "authenticated",
        resource_type: "image",
      }),
    );
    resource.mockRejectedValue({
      error: { http_code: 404, message: "secret provider message" },
    });
    await expect(gateway.inspect("key")).rejects.toMatchObject({
      code: "UPLOAD_NOT_FOUND_AT_PROVIDER",
    });
    resource.mockRejectedValue(new Error("secret provider error"));
    await expect(gateway.inspect("key")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });
  it("creates a five-minute authenticated download and retries failed deletion", async () => {
    const download = jest
      .spyOn(cloudinary.utils, "private_download_url")
      .mockReturnValue("https://test.invalid/download");
    const destroy = jest
      .spyOn(cloudinary.uploader, "destroy")
      .mockResolvedValue({ result: "ok" } as any);
    const gateway = new CloudinaryGateway(new ConfigService(values));
    const ticket = gateway.download("key", "pdf");
    expect(ticket.expiresAt.getTime() - Date.now()).toBeGreaterThan(299000);
    expect(download).toHaveBeenCalledWith(
      "key",
      "pdf",
      expect.objectContaining({
        type: "authenticated",
        attachment: true,
        expires_at: expect.any(Number),
      }),
    );
    await gateway.destroy("key");
    expect(destroy).toHaveBeenCalledWith(
      "key",
      expect.objectContaining({ invalidate: true, type: "authenticated" }),
    );
    destroy.mockRejectedValue(new Error("offline"));
    await expect(gateway.destroy("key")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });
  it("rejects partial Cloudinary configuration", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://test.invalid/test",
        FRONTEND_URL: "http://localhost:3000",
        JWT_ACCESS_SECRET: "a".repeat(32),
        JWT_REFRESH_SECRET: "b".repeat(32),
        CLOUDINARY_CLOUD_NAME: "test-cloud",
      }),
    ).toThrow("Set CLOUDINARY_CLOUD_NAME");
  });
});
