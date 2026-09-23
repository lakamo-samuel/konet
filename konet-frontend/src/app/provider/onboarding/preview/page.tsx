import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {PublishProviderButton} from "@/features/provider-onboarding/components/publish-provider-button";
export const metadata={title:"Preview provider profile"};
export default function Page(){return <section className="workspace-page narrow"><div className="page-heading"><span className="eyebrow">Step 5 of 5</span><h1>Verification and review</h1><p>Your provider profile can only be published after your identity and work evidence are approved.</p></div><article className="surface-panel onboarding-preview"><Badge>Verification passed</Badge><h2>Your professional title</h2><p>Your approved bio, services, work evidence, campus, and starting price will appear here.</p><strong>Student verified · Identity verified · Work reviewed</strong></article><div className="action-row"><PublishProviderButton/><Button href="/provider/onboarding/profile" variant="secondary">Edit profile</Button></div></section>}
