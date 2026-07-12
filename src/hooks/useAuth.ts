"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("barber_admin_token");
    if (!token) {
      router.replace("/login");
    }
  }, [router]);
}

export function logout() {
  localStorage.removeItem("barber_admin_token");
  localStorage.removeItem("barber_admin_refresh_token");
  window.location.href = "/login";
}
