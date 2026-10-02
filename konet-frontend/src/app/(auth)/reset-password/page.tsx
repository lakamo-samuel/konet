import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
export const metadata = { title: "Reset password" };
export default function Page() {
  return (
    <div className="auth-panel">
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h2>Choose a new password.</h2>
      <p>Use the recovery link sent to your email.</p>
      <ResetPasswordForm />
    </div>
  );
}
