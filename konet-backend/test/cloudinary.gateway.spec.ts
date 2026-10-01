import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryGateway } from "../src/modules/uploads/cloudinary.gateway";
import { validateEnvironment } from "../src/config/env";
describe("private Cloudinary gateway", () => {
  const values = {
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-key",
    CLOUDINARY_API_SECRET: "test-secret",
    CLOUDINARY_MALWARE_SCAN_ENABLED: true,
  };
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
    expect(ticket.fields.moderation).toBe("perception_point");
    expect(JSON.stringify(ticket)).not.toContain("test-secret");
    const { api_key, signature, ...params } = ticket.fields;
    expect(api_key).toBe("test-key");
    expect(signature).toBe(
      cloudinary.utils.api_sign_request(params, "test-secret"),
    );
  });
  it("fails closed when credentials or malware moderation are missing", () => {
    expect(() =>
      new CloudinaryGateway(new ConfigService({})).ticket("key"),
    ).toThrow("Cloudinary storage is not configured");
    expect(() =>
      new CloudinaryGateway(
        new ConfigService({
          ...values,
          CLOUDINARY_MALWARE_SCAN_ENABLED: false,
        }),
      ).ticket("key"),
    ).toThrow("Enable Cloudinary malware");
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
        moderation: true,
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
