"use client";
import { useRouter } from "next/navigation";
import { useDataCommand } from "@/lib/query/hooks";
import { errorMessage } from "@/data/access/client";
export function SignOutButton() {
  const signOut = useDataCommand("signOut");
  const router = useRouter();
  return (
    <span>
      <button
        type="button"
        className="signin-button"
        disabled={signOut.isPending}
        onClick={async () => {
          try {
            await signOut.mutateAsync({});
            router.replace("/sign-in");
            router.refresh();
          } catch {
            /* shown below */
          }
        }}
      >
        {signOut.isPending ? "Signing out…" : "Sign out"}
      </button>
      {signOut.isError && (
        <span role="alert" className="field-error">
          {errorMessage(signOut.error)}
        </span>
      )}
    </span>
  );
}
