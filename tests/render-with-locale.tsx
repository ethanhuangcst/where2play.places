import { render } from "@testing-library/react";
import { LocaleProvider } from "@/src/i18n/locale-provider";

export function renderWithLocale(ui: React.ReactElement, locale: "EN" | "CN" | "HK" | "TW" = "EN") {
  return render(<LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>);
}
