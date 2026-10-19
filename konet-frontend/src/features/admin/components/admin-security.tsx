"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { AdminAction } from "./admin-action";
import { record, text } from "../resources";
import type { AdminRecord } from "../operations";
export function AdminSecurity({
  status,
  onVerified,
}: {
  status: AdminRecord;
  onVerified?: () => void;
}) {
  const [enrollment, setEnrollment] = useState<AdminRecord | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [qr, setQr] = useState("");
  useEffect(() => {
    let current = true;
    if (typeof enrollment?.uri === "string")
      void QRCode.toDataURL(enrollment.uri, { width: 220, margin: 2 })
        .then((value) => {
          if (current) setQr(value);
        })
        .catch(() => {
          if (current) setQr("");
        });
    return () => {
      current = false;
    };
  }, [enrollment]);
  return (
    <div className="admin-security">
      <h2>Staff security</h2>
      <p>
        Use an authenticator app to protect staff access. Verification applies
        to this session for 15 minutes. Keep recovery codes in a safe place
        outside this browser.
      </p>
      {codes.length > 0 && (
        <section className="admin-recovery" role="status">
          <h3>Save your recovery codes now</h3>
          <p>
            Each code works once. These codes will not be shown again. Losing
            both your authenticator and recovery codes requires help from the
            server operator.
          </p>
          <div className="admin-codes">
            {codes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setCodes([]);
              setEnrollment(null);
              setQr("");
            }}
          >
            I have saved my recovery codes
          </button>
        </section>
      )}
      {!status.enabled && !enrollment && (
        <AdminAction
          operation="enrollMfa"
          onSuccess={(result) => setEnrollment(record(result))}
        />
      )}
      {!status.enabled && enrollment && (
        <section>
          <h3>Add Konet to your authenticator</h3>
          {qr && (
            <Image
              unoptimized
              src={qr}
              alt="Scan this QR code with your authenticator app"
              width={220}
              height={220}
            />
          )}
          <p>Or enter this setup key manually:</p>
          <code className="admin-secret">{text(enrollment.secret)}</code>
          <p>
            Setup expires at{" "}
            {new Date(String(enrollment.expiresAt)).toLocaleTimeString()}.
          </p>
          <AdminAction
            operation="confirmMfa"
            onSuccess={(result) => {
              const response = record(result);
              setCodes(
                Array.isArray(response.recoveryCodes)
                  ? response.recoveryCodes.filter(
                      (code): code is string => typeof code === "string",
                    )
                  : [],
              );
              setEnrollment(null);
              setQr("");
            }}
          />
          <button
            type="button"
            onClick={() => {
              setEnrollment(null);
              setQr("");
            }}
          >
            Restart setup
          </button>
        </section>
      )}
      {Boolean(status.enabled) && (
        <>
          <p>
            {status.verified
              ? `Verified until ${new Date(String(status.expiresAt)).toLocaleTimeString()}.`
              : "Verify your authenticator to open staff tools."}
          </p>
          <AdminAction
            operation="verifyMfa"
            onSuccess={() => onVerified?.()}
          />
          <p>{text(status.recoveryCodesRemaining)} recovery codes remaining.</p>
        </>
      )}
    </div>
  );
}
