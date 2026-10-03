import { RequestWorkspace } from "@/features/hiring/components/request-workspace";
export const metadata = { title: "Service request" };
export default async function Page({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <section className="workspace-page narrow">
      <h1>Service request</h1>
      <RequestWorkspace id={requestId} />
    </section>
  );
}
