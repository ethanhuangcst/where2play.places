import { isValidNationality } from "@/src/core/country-codes";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type RegisterField =
  | "name"
  | "email"
  | "age"
  | "password"
  | "password_confirm"
  | "photo"
  | "nationality";

export type RegisterClientInput = {
  name: string;
  email: string;
  age: string;
  password: string;
  confirmPassword: string;
  nationality?: string;
};

const FIELD_ORDER: RegisterField[] = [
  "name",
  "email",
  "age",
  "password",
  "password_confirm",
  "nationality",
  "photo",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterClient(input: RegisterClientInput): Partial<Record<RegisterField, string>> {
  const errors: Partial<Record<RegisterField, string>> = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const ageRaw = input.age.trim();
  const password = input.password;
  const confirm = input.confirmPassword;

  if (!name) errors.name = "play.errors.name_required";
  if (!email) errors.email = "play.errors.email_required";
  else if (!EMAIL_RE.test(email)) errors.email = "play.errors.email_invalid";
  if (ageRaw) {
    const age = Number(ageRaw);
    if (!Number.isFinite(age) || age < 13 || age > 120) errors.age = "play.errors.age_out_of_range";
  }
  if (!password) errors.password = "play.errors.password_required";
  else if (password.length < 8) errors.password = "play.errors.password_too_short";
  if (!confirm) errors.password_confirm = "play.errors.password_required";
  else if (confirm.length < 8) errors.password_confirm = "play.errors.password_too_short";
  else if (password !== confirm) errors.password_confirm = "play.errors.password_mismatch";
  const nationality = input.nationality?.trim().toUpperCase() ?? "";
  if (nationality && !isValidNationality(nationality)) {
    errors.nationality = "play.errors.nationality_invalid";
  }

  return errors;
}

export function firstRegisterField(
  errors: Partial<Record<RegisterField, string>>,
): RegisterField | undefined {
  return FIELD_ORDER.find((field) => errors[field]);
}

/** Map server-side Zod failures to a field-scoped auth error (avoid generic validation-only). */
export function registerSchemaFailure(error: {
  issues: Array<{ path: PropertyKey[]; code: string }>;
}): { key: string; field?: RegisterField } {
  const issue = error.issues[0];
  const path = issue?.path[0];
  if (path === "name") return { key: "errors.name_required", field: "name" };
  if (path === "email") {
    if (issue.code === "invalid_format" || issue.code === "invalid_type") {
      return { key: "errors.email_invalid", field: "email" };
    }
    return { key: "errors.email_required", field: "email" };
  }
  if (path === "password") return { key: "errors.password_too_short", field: "password" };
  if (path === "confirmPassword") {
    return { key: "errors.password_too_short", field: "password_confirm" };
  }
  if (path === "age") return { key: "errors.age_out_of_range", field: "age" };
  if (path === "nationality") return { key: "errors.nationality_invalid", field: "nationality" };
  if (path === "photoUrl") return { key: "errors.photo_too_large", field: "photo" };
  return { key: "errors.validation" };
}

export function mapApiErrorToField(
  key: string,
  apiField?: string,
): {
  field?: RegisterField;
  errorKey: string;
  formLevel: boolean;
} {
  const playKey = key.startsWith("errors.") ? `play.errors.${key.slice("errors.".length)}` : key;
  const registerFields = new Set<RegisterField>([
    "name",
    "email",
    "age",
    "password",
    "password_confirm",
    "nationality",
    "photo",
  ]);
  if (apiField && registerFields.has(apiField as RegisterField)) {
    return {
      field: apiField as RegisterField,
      errorKey: playKey.startsWith("play.errors.") ? playKey : "play.errors.network",
      formLevel: false,
    };
  }

  switch (key) {
    case "errors.name_required":
      return { field: "name", errorKey: "play.errors.name_required", formLevel: false };
    case "errors.email_required":
      return { field: "email", errorKey: "play.errors.email_required", formLevel: false };
    case "errors.email_invalid":
      return { field: "email", errorKey: "play.errors.email_invalid", formLevel: false };
    case "errors.email_taken":
      return { field: "email", errorKey: "play.errors.email_taken", formLevel: false };
    case "errors.password_required":
      return { field: "password", errorKey: "play.errors.password_required", formLevel: false };
    case "errors.password_too_short":
      return { field: "password", errorKey: "play.errors.password_too_short", formLevel: false };
    case "errors.password_mismatch":
      return { field: "password_confirm", errorKey: "play.errors.password_mismatch", formLevel: false };
    case "errors.age_required":
      return { field: "age", errorKey: "play.errors.age_required", formLevel: false };
    case "errors.age_out_of_range":
      return { field: "age", errorKey: "play.errors.age_out_of_range", formLevel: false };
    case "errors.photo_too_large":
      return { field: "photo", errorKey: "play.errors.photo_too_large", formLevel: false };
    case "errors.nationality_invalid":
      return { field: "nationality", errorKey: "play.errors.nationality_invalid", formLevel: false };
    case "errors.csrf":
      return { errorKey: "play.errors.csrf", formLevel: true };
    case "errors.session_expired":
      return { errorKey: "play.errors.session_expired", formLevel: true };
    default:
      return {
        errorKey: playKey.startsWith("play.errors.") ? playKey : "play.errors.network",
        formLevel: true,
      };
  }
}
