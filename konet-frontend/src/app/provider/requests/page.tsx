import { RequestList } from "@/features/hiring/components/work-lists";
export const metadata = { title: "Provider requests" };
export default function Page() {
  return (
    <section className="provider-page">
      <h1>Incoming service requests</h1>
      <RequestList provider />
    </section>
  );
}
