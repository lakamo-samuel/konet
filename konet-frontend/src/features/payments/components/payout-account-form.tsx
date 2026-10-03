"use client";
import { useState } from "react";
import { useDataCommand, useDataQuery } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
import { Button } from "@/components/ui/button";
export function PayoutAccountForm() {
  const accounts = useDataQuery("payoutAccounts", {});
  const banks = useDataQuery("payoutBanks", {});
  const add = useDataCommand("addPayoutAccount");
  const remove = useDataCommand("removePayoutAccount");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  return (
    <section className="workspace-card form-stack">
      <h2>Payout bank account</h2>
      {accounts.isPending && <p role="status">Loading payout account…</p>}
      {accounts.isError && <p role="alert">{errorMessage(accounts.error)}</p>}
      {accounts.data?.map((a) => (
        <article key={a.id}>
          <p>
            {a.accountName} ·{" "}
            {banks.data?.find((b) => b.code === a.bankCode)?.name ??
              `Bank ${a.bankCode}`}{" "}
            · •••• {a.accountNumberLast4}
          </p>
          <p>Status: {a.status}</p>
          <Button
            variant="secondary"
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Remove this payout account? Pending transfers may prevent removal.",
                )
              )
                remove.mutate({ id: a.id });
            }}
          >
            Remove account
          </Button>
        </article>
      ))}
      {accounts.isSuccess && accounts.data.length === 0 && (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await add.mutateAsync({ bankCode, accountNumber });
              setAccountNumber("");
            } catch {
              /* Mutation error is displayed below. */
            }
          }}
        >
          <p>
            Add the account that should receive your payouts. Paystack resolves
            the account name; provider approval is required.
          </p>
          <label className="field">
            Bank
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              required
              disabled={banks.isPending || banks.isError || add.isPending}
            >
              <option value="">Choose a bank</option>
              {banks.data?.map((b) => (
                <option value={b.code} key={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Account number
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{10}"
              minLength={10}
              maxLength={10}
              required
              disabled={add.isPending}
            />
          </label>
          <Button type="submit" disabled={add.isPending || !banks.data?.length}>
            {add.isPending ? "Verifying account…" : "Verify and save account"}
          </Button>
        </form>
      )}
      {banks.isError && <p role="alert">{errorMessage(banks.error)}</p>}
      {(add.isError || remove.isError) && (
        <p role="alert">{errorMessage(add.error ?? remove.error)}</p>
      )}
      <p>
        Payouts are queued after the client confirms completion. Bank details
        alone do not confirm a transfer.
      </p>
    </section>
  );
}
