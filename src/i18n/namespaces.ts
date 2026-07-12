export const NAMESPACES = [
  "Common",
  "Nav",
  "Login",
  "Onboarding",
  "Dashboard",
  "Appointments",
  "Barbers",
  "BarberDetail",
  "Clients",
  "ClientDetail",
  "Services",
  "Schedule",
  "Promotions",
  "Finance",
  "Analytics",
  "Profile",
  "KakaoMap",
] as const;

export type Namespace = (typeof NAMESPACES)[number];
