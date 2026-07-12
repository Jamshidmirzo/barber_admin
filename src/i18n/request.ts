import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName } from "./config";
import { NAMESPACES } from "./namespaces";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const messages: Record<string, unknown> = {};
  await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`./messages/${locale}/${ns}.json`);
      messages[ns] = mod.default ?? mod;
    })
  );

  return { locale, messages };
});
