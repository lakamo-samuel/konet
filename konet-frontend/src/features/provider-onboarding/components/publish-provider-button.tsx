"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";
import { useDataCommand } from "@/lib/query/hooks";
export function PublishProviderButton() {
  const router = useRouter();
  const publish = useDataCommand("publishProvider");
  return <div><Button disabled={publish.isPending} onClick={async () => { try { await publish.mutateAsync({}); router.push("/provider/dashboard"); } catch { /* Error is shown below. */ } }}>{publish.isPending ? "Publishing…" : "Publish provider profile"}</Button>{publish.isError && <p role="alert" className="mt-2 text-sm text-red-700">{errorMessage(publish.error)}</p>}</div>;
}
