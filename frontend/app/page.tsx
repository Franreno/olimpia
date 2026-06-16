"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { homeForRole } from "@/lib/nav";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? homeForRole(user.perfil) : "/login");
  }, [isLoading, user, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}
