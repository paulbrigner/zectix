"use client";

const RESET_FIELD_NAMES = [
  "embed_accent_color",
  "embed_background_color",
  "embed_surface_color",
  "embed_text_color",
  "embed_radius_px",
] as const;

function updateFieldValue(
  form: HTMLFormElement,
  selector: string,
  value: string,
) {
  const input = form.querySelector(selector);

  if (
    !(input instanceof HTMLInputElement) &&
    !(input instanceof HTMLTextAreaElement)
  ) {
    return;
  }

  input.value = value;
  input.defaultValue = value;
  input.setAttribute("value", value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function updateCheckboxValue(
  form: HTMLFormElement,
  selector: string,
  checked: boolean,
) {
  const input = form.querySelector(selector);

  if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") {
    return;
  }

  input.checked = checked;
  if (checked) {
    input.setAttribute("checked", "");
  } else {
    input.removeAttribute("checked");
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function EmbedAppearanceResetButton({
  defaultHeight,
}: {
  defaultHeight: number;
}) {
  return (
    <button
      className="button button-secondary button-small"
      onClick={(event) => {
        const form = event.currentTarget.closest("form");
        if (!(form instanceof HTMLFormElement)) {
          return;
        }

        for (const name of RESET_FIELD_NAMES) {
          updateFieldValue(form, `[name="${CSS.escape(name)}"]`, "");
        }

        updateCheckboxValue(
          form,
          '[name="embed_dynamic_height"]',
          true,
        );

        updateFieldValue(
          form,
          '[data-embed-height-visible="true"]',
          String(defaultHeight),
        );
      }}
      type="button"
    >
      Reset to defaults
    </button>
  );
}
