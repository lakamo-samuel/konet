import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DomainError } from "../../common/errors/domain.error";
@Injectable()
export class SocketTicketService {
  private tickets = new Map<string, { token: string; expiresAt: number }>();
  issue(token: string) {
    this.prune();
    if (this.tickets.size >= 5000)
      throw new DomainError(
        "SOCKET_TICKET_LIMIT",
        "Please retry connecting shortly.",
        429,
      );
    const ticket = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 30000;
    this.tickets.set(ticket, { token, expiresAt });
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }
  consume(ticket: unknown): string {
    if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(ticket))
      throw new Error("Invalid socket ticket");
    const saved = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!saved || saved.expiresAt <= Date.now())
      throw new Error("Expired or consumed socket ticket");
    return saved.token;
  }
  private prune() {
    for (const [key, saved] of this.tickets)
      if (saved.expiresAt <= Date.now()) this.tickets.delete(key);
  }
}
