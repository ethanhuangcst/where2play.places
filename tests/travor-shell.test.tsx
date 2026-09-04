/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { renderWithLocale } from "./render-with-locale";
import { PublicShell } from "@/src/ui/public-shell";
import { AppShell } from "@/src/ui/app-shell";
import RegisterPageClient from "@/src/ui/register-page";
import ProfilePageClient from "@/src/ui/profile-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/src/ui/auth-api", () => ({
  authJson: vi.fn().mockRejectedValue(new Error("offline")),
  AuthApiError: class AuthApiError extends Error {},
}));

describe("TC-M10-46-12 travor shell", () => {
  it("should_set_data_style_travor_on_public_shell", () => {
    renderWithLocale(
      <PublicShell>
        <div>child</div>
      </PublicShell>,
    );
    expect(document.body.dataset.style).toBe("travor");
    expect(document.body.className).toBe("shell-public");
  });

  it("should_set_data_style_travor_on_app_shell", () => {
    renderWithLocale(
      <AppShell>
        <div>child</div>
      </AppShell>,
    );
    expect(document.body.dataset.style).toBe("travor");
    expect(document.body.className).toBe("shell-app");
  });

  it("should_render_register_photo_field", () => {
    const { getByTestId } = renderWithLocale(<RegisterPageClient />);
    expect(getByTestId("field-photo")).toBeTruthy();
  });

  it("should_render_profile_photo_field", async () => {
    const { authJson } = await import("@/src/ui/auth-api");
    vi.mocked(authJson).mockResolvedValue({
      name: "Mei",
      email: "m@example.com",
      interests: [],
    });
    const { getByTestId } = renderWithLocale(<ProfilePageClient />);
    expect(getByTestId("field-photo")).toBeTruthy();
  });
});
