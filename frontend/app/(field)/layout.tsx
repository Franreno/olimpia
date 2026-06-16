import { AuthGuard } from "@/components/auth-guard";

export default function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
