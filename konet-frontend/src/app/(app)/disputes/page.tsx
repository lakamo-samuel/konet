import { DisputeList } from "@/features/disputes/components/dispute-workspace";
export const metadata = { title: "Disputes" };
export default function Page() {
  return (
    <section className="workspace-page narrow">
      <div className="page-heading">
        <h1>Your disputes</h1>
        <p>Track cases for jobs you hired or provided.</p>
      </div>
      <DisputeList />
    </section>
  );
}
