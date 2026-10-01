import { ContactForm } from "@/features/contact/components/contact-form";
export const metadata = { title: "Contact" };
export default function Page() { return <div className="legal-page"><span className="eyebrow">Contact</span><h1>How can we help?</h1><p>For account, payment, safety, or partnership questions, send the team a clear note.</p><ContactForm /></div>; }
