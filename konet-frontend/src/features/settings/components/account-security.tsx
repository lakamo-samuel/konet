"use client";
import { formatTime } from "@/lib/formatters/date";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
import type { EmailChangeChallenge } from "@/types/account-settings";
export function AccountSecurity({ email }: { email: string }) {
  return (
    <>
      <EmailChange key={email} email={email} />
      <PasswordChange />
      <DeactivateAccount />
    </>
  );
}
function EmailChange({ email }: { email: string }) {
  const request = useDataCommand("requestEmailChange");
  const confirm = useDataCommand("confirmEmailChange");
  const router = useRouter();
  const [challenge, setChallenge] = useState<EmailChangeChallenge | null>(null);
  const [target, setTarget] = useState("");
  const [failure, setFailure] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);
  const cooldown = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAfter) - now) / 1000))
    : 0;
  const expired = !!challenge && now >= Date.parse(challenge.expiresAt);
  return (
    <section className="surface-panel form-stack">
      <h2>Change login email</h2>
      <p>
        Current email: {email}. A code will be sent to the new address.
        Confirmation signs you out on every device; university verification
        stays separate.
      </p>
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          if (request.isPending || confirm.isPending || cooldown) return;
          setFailure("");
          const form = event.currentTarget;
          const values = new FormData(form);
          const nextEmail = String(values.get("email")).trim();
          if (nextEmail === email) {
            setFailure("Enter a different email address.");
            return;
          }
          try {
            const next = await request.mutateAsync({
              email: nextEmail,
              password: String(values.get("password")),
            });
            setChallenge(next);
            setTarget(nextEmail);
            setNow(Date.now());
          } catch (cause) {
            setFailure(errorMessage(cause));
          } finally {
            const field = form.elements.namedItem(
              "password",
            ) as HTMLInputElement;
            field.value = "";
            request.reset();
          }
        }}
      >
        <fieldset
          disabled={request.isPending || confirm.isPending}
          className="form-stack"
        >
          <label className="field">
            New email
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={255}
              required
            />
          </label>
          <label className="field">
            Current password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
            />
          </label>
          <Button type="submit" disabled={cooldown > 0}>
            {request.isPending
              ? "Requesting…"
              : cooldown
                ? `Request again in ${cooldown}s`
                : challenge
                  ? "Request a new code"
                  : "Request email code"}
          </Button>
        </fieldset>
      </form>
      {challenge && (
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (confirm.isPending || expired) return;
            setFailure("");
            const form = event.currentTarget;
            try {
              await confirm.mutateAsync({
                challengeId: challenge.challengeId,
                code: String(new FormData(form).get("code")),
              });
              router.replace("/sign-in");
              router.refresh();
            } catch (cause) {
              setFailure(errorMessage(cause));
            } finally {
              form.reset();
              confirm.reset();
            }
          }}
        >
          <p>
            Code queued for {target}. Expires{" "}
            {formatTime(challenge.expiresAt)}.{" "}
            {expired && "Request a new code."}
          </p>
          <label className="field">
            Six-digit code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              disabled={expired}
            />
          </label>
          <Button
            type="submit"
            disabled={confirm.isPending || request.isPending || expired}
          >
            {confirm.isPending ? "Confirming…" : "Confirm new email"}
          </Button>
        </form>
      )}
      {failure && <p role="alert">{failure}</p>}
    </section>
  );
}
function PasswordChange() {
  const change = useDataCommand("changePassword");
  const router = useRouter();
  const [failure, setFailure] = useState("");
  return (
    <form
      className="surface-panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (change.isPending) return;
        setFailure("");
        const form = event.currentTarget;
        const values = new FormData(form);
        if (values.get("newPassword") !== values.get("confirmPassword")) {
          setFailure("New passwords must match.");
          return;
        }
        try {
          await change.mutateAsync({
            currentPassword: String(values.get("currentPassword")),
            newPassword: String(values.get("newPassword")),
          });
          router.replace("/sign-in");
          router.refresh();
        } catch (cause) {
          setFailure(errorMessage(cause));
        } finally {
          form.reset();
          change.reset();
        }
      }}
    >
      <h2>Change password</h2>
      <p>
        Successful changes sign you out on every device. Sign in again with your
        new password.
      </p>
      <fieldset disabled={change.isPending} className="form-stack">
        <label className="field">
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label className="field">
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="field">
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <Button type="submit">
          {change.isPending ? "Changing…" : "Change password"}
        </Button>
      </fieldset>
      {failure && <p role="alert">{failure}</p>}
    </form>
  );
}
function DeactivateAccount() {
  const deactivate = useDataCommand("deactivateAccount");
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [failure, setFailure] = useState("");
  return (
    <form
      className="surface-panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!confirmed || deactivate.isPending) return;
        setFailure("");
        try {
          await deactivate.mutateAsync({
            reason: String(
              new FormData(event.currentTarget).get("reason"),
            ).trim(),
          });
          router.replace("/sign-in");
          router.refresh();
        } catch (cause) {
          setFailure(errorMessage(cause));
        }
      }}
    >
      <h2>Deactivate account</h2>
      <p>
        This disables sign-in and hides your provider profile. Historical jobs,
        messages and financial records remain. There is no self-service
        reactivation. Active jobs and unsettled payments must be resolved first.
      </p>
      <label className="field">
        Reason
        <textarea name="reason" minLength={3} maxLength={2000} required />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I understand and want to deactivate my account.
      </label>
      <Button type="submit" disabled={!confirmed || deactivate.isPending}>
        {deactivate.isPending ? "Deactivating…" : "Deactivate account"}
      </Button>
      {failure && <p role="alert">{failure}</p>}
    </form>
  );
}
