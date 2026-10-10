import { AuthForm } from "@/components/auth-form";
import { getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("auth.createAccountTitle") };
}

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
