import { RequestList } from "@/features/hiring/components/work-lists";
export const metadata = { title: "My requests" };
export default function Page() {
  return (
    <section className="workspace-page">
      <h1>My service requests</h1>
      <RequestList />
    </section>
  );
}
