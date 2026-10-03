import { JobList } from "@/features/hiring/components/work-lists";
export const metadata = { title: "Jobs" };
export default function Page() {
  return (
    <section className="workspace-page">
      <h1>My jobs</h1>
      <JobList />
    </section>
  );
}
