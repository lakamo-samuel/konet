"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "./button";

export function RetryPageButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button variant="secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Trying again…" : "Try again"}</Button>;
}
