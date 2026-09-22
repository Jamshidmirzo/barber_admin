export const NAMESPACES = [
  "Common",
  "Nav",
  "Login",
  "Onboarding",
  "Dashboard",
  "Barbers",
  "BarberDetail",
  "Clients",
  "ClientDetail",
  "Services",
  "Schedule",
  "Finance",
  "Analytics",
  "Profile",
  "KakaoMap",
  "YandexMap",
] as const;

export type Namespace = (typeof NAMESPACES)[number];
