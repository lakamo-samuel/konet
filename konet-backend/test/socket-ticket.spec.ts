import { SocketTicketService } from "../src/modules/realtime/socket-ticket.service";
describe("single-use socket tickets", () => {
  afterEach(() => jest.restoreAllMocks());
  it("issues an opaque credential, consumes it once, and does not expose the access token", () => {
    const service = new SocketTicketService();
    const result = service.issue("private-access-token");
    expect(result.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(result)).not.toContain("private-access-token");
    expect(service.consume(result.ticket)).toBe("private-access-token");
    expect(() => service.consume(result.ticket)).toThrow();
  });
  it("rejects expired and unknown tickets", () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
    const service = new SocketTicketService();
    const result = service.issue("token");
    clock.mockReturnValue(31000);
    expect(() => service.consume(result.ticket)).toThrow();
    expect(() => service.consume("x".repeat(43))).toThrow();
    expect(() => service.consume({ ticket: result.ticket })).toThrow();
  });
});
