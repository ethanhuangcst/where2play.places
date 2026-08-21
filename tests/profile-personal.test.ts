import { describe, expect, it } from "vitest";
import { GET as getPersonal, PUT as putPersonal } from "../app/api/profile/personal/route";
import { bffRequest, invokeRoute, readJson } from "./helpers/http-bff";
import {
  authedRequest,
  loginTestUser,
  registerTestUser,
  TEST_USER,
} from "./helpers/test-user";

describe("/api/profile/personal", () => {
  it("should_get_profile_when_authenticated", async () => {
    await registerTestUser({ interests: ["museum", "spa"] });
    await loginTestUser();
    const res = await invokeRoute(getPersonal, authedRequest("/api/profile/personal"));
    expect(res.status).toBe(200);
    const body = await readJson<{ email: string; interests: string[] }>(res);
    expect(body.email).toBe(TEST_USER.email);
    expect(body.interests).toEqual(["museum", "spa"]);
  });

  it("should_reject_unauthenticated_get", async () => {
    const res = await invokeRoute(getPersonal, bffRequest("/api/profile/personal"));
    expect(res.status).toBe(401);
  });

  it("should_update_personal_fields_and_interests", async () => {
    await registerTestUser();
    await loginTestUser();
    const res = await invokeRoute(
      putPersonal,
      authedRequest("/api/profile/personal", {
        method: "PUT",
        body: {
          name: "Updated Name",
          email: TEST_USER.email,
          defaultLocation: "Taipei",
          age: 28,
          interests: ["night_market", "restaurant"],
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ name: string; defaultLocation: string; interests: string[] }>(res);
    expect(body.name).toBe("Updated Name");
    expect(body.defaultLocation).toBe("Taipei");
    expect(body.interests).toEqual(["night_market", "restaurant"]);
  });

  it("should_persist_default_lat_lng", async () => {
    await registerTestUser();
    await loginTestUser();
    const res = await invokeRoute(
      putPersonal,
      authedRequest("/api/profile/personal", {
        method: "PUT",
        body: {
          name: TEST_USER.name,
          email: TEST_USER.email,
          defaultLocation: "Central, Hong Kong",
          defaultLat: 22.3193,
          defaultLng: 114.1694,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ defaultLat: number; defaultLng: number }>(res);
    expect(body.defaultLat).toBe(22.3193);
    expect(body.defaultLng).toBe(114.1694);
  });

  it("should_reject_photo_too_large", async () => {
    await registerTestUser();
    await loginTestUser();
    const huge = `data:image/png;base64,${"A".repeat(3_000_000)}`;
    const res = await invokeRoute(
      putPersonal,
      authedRequest("/api/profile/personal", {
        method: "PUT",
        body: {
          name: TEST_USER.name,
          email: TEST_USER.email,
          defaultLocation: "London",
          photoUrl: huge,
        },
      }),
    );
    expect(res.status).toBe(400);
  });
});
