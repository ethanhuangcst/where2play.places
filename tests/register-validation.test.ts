import { describe, expect, it } from "vitest";
import {
  firstRegisterField,
  mapApiErrorToField,
  validateRegisterClient,
} from "@/src/auth/register-validation";

describe("validateRegisterClient", () => {
  const valid = {
    name: "Mei Chen",
    email: "mei@example.com",
    age: "28",
    password: "testpass123",
    confirmPassword: "testpass123",
  };

  it("should_pass_when_all_fields_valid", () => {
    expect(validateRegisterClient(valid)).toEqual({});
  });

  it("should_pass_when_age_empty", () => {
    expect(validateRegisterClient({ ...valid, age: "" })).toEqual({});
  });

  it("should_flag_age_out_of_range_when_provided", () => {
    const errors = validateRegisterClient({ ...valid, age: "10" });
    expect(errors.age).toBe("play.errors.age_out_of_range");
  });

  it("should_flag_password_too_short", () => {
    const errors = validateRegisterClient({ ...valid, password: "abc", confirmPassword: "abc" });
    expect(errors.password).toBe("play.errors.password_too_short");
    expect(errors.password_confirm).toBe("play.errors.password_too_short");
  });

  it("should_flag_password_mismatch", () => {
    const errors = validateRegisterClient({
      ...valid,
      password: "testpass123",
      confirmPassword: "testpass999",
    });
    expect(errors.password_confirm).toBe("play.errors.password_mismatch");
  });

  it("should_flag_name_required", () => {
    expect(validateRegisterClient({ ...valid, name: "" }).name).toBe("play.errors.name_required");
  });

  it("should_flag_invalid_email", () => {
    expect(validateRegisterClient({ ...valid, email: "not-an-email" }).email).toBe(
      "play.errors.email_invalid",
    );
  });

  it("should_map_api_errors_to_fields", () => {
    expect(mapApiErrorToField("errors.name_required").field).toBe("name");
    expect(mapApiErrorToField("errors.email_required").field).toBe("email");
    expect(mapApiErrorToField("errors.email_invalid").field).toBe("email");
    expect(mapApiErrorToField("errors.password_required").field).toBe("password");
    expect(mapApiErrorToField("errors.photo_too_large").field).toBe("photo");
    expect(mapApiErrorToField("errors.session_expired").formLevel).toBe(true);
    expect(mapApiErrorToField("errors.unknown").errorKey).toBe("play.errors.unknown");
  });

  it("should_map_csrf_to_form_level", () => {
    const mapped = mapApiErrorToField("errors.csrf");
    expect(mapped.formLevel).toBe(true);
    expect(mapped.errorKey).toBe("play.errors.csrf");
  });
});

describe("firstRegisterField", () => {
  it("should_return_first_invalid_field_in_order", () => {
    expect(
      firstRegisterField({
        password: "play.errors.password_too_short",
        name: "play.errors.name_required",
      }),
    ).toBe("name");
  });
});
