/*
  VPXS YML Creator Redesign
  Stage 1: Shared wizard group renderer
*/

import { FIELD_TYPES } from "./fields.js?v=20260709-2";
import {
  createElement,
  evaluateGroupState,
  getGroupStateLabel,
  humanize
} from "./uiHelper.js?v=20260709-2";

function toArrayInputValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value ?? "";
}

function isCheckedValue(value) {
  return value === true || value === "true";
}

function emitFieldChange(card, fieldName, value) {
  card.dispatchEvent(new CustomEvent("wizard-field-change", {
    bubbles: true,
    detail: { fieldName, value }
  }));
}

function createHelpText(field) {
  if (!field.help) return null;

  return createElement("p", {
    className: "wizard-field__help",
    text: field.help
  });
}

function createBooleanField(card, field, value) {
  const inputId = `${card.id}-${field.name}`;
  const input = createElement("input", {
    attrs: {
      id: inputId,
      name: field.name,
      type: "checkbox"
    }
  });
  input.checked = isCheckedValue(value);

  input.addEventListener("change", () => emitFieldChange(card, field.name, input.checked));

  const label = createElement("label", {
    className: "wizard-check",
    attrs: { for: inputId },
    children: [
      input,
      createElement("span", { text: field.label })
    ]
  });

  return createElement("div", {
    className: "wizard-field wizard-field--boolean",
    dataset: { fieldName: field.name },
    children: [label, createHelpText(field)]
  });
}

function createArrayOptionsField(card, field, value) {
  const selected = new Set(Array.isArray(value) ? value : String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  const wrapper = createElement("div", {
    className: "wizard-field wizard-field--array-options",
    dataset: { fieldName: field.name }
  });

  wrapper.appendChild(createElement("div", {
    className: "wizard-field__label",
    text: field.label
  }));

  const optionGroup = createElement("div", { className: "wizard-array-options" });

  field.options.forEach((option) => {
    const inputId = `${card.id}-${field.name}-${option.value}`;
    const checkbox = createElement("input", {
      attrs: {
        id: inputId,
        name: field.name,
        type: "checkbox",
        value: option.value
      }
    });
    checkbox.checked = selected.has(option.value);

    checkbox.addEventListener("change", () => {
      const values = Array.from(optionGroup.querySelectorAll("input:checked")).map((input) => input.value);
      emitFieldChange(card, field.name, values);
    });

    optionGroup.appendChild(createElement("label", {
      className: "wizard-pill-check",
      attrs: { for: inputId },
      children: [
        checkbox,
        createElement("span", { text: option.label })
      ]
    }));
  });

  wrapper.appendChild(optionGroup);
  wrapper.appendChild(createHelpText(field));
  return wrapper;
}

function createStandardControl(card, field, value, disabled = false) {
  const inputId = `${card.id}-${field.name}`;
  let control;

  if (field.type === FIELD_TYPES.TEXTAREA) {
    control = createElement("textarea", {
      attrs: {
        id: inputId,
        name: field.name,
        rows: 4,
        placeholder: field.placeholder ?? ""
      }
    });
    control.value = value ?? "";
  } else if (field.type === FIELD_TYPES.SELECT) {
    control = createElement("select", {
      attrs: {
        id: inputId,
        name: field.name
      }
    });

    (field.options ?? []).forEach((option) => {
      const optionNode = createElement("option", {
        text: option.label,
        attrs: { value: option.value }
      });
      optionNode.selected = option.value === (value ?? "");
      control.appendChild(optionNode);
    });
  } else {
    const inputType = field.type === FIELD_TYPES.NUMBER
      ? "number"
      : field.type === FIELD_TYPES.URL
        ? "url"
        : "text";

    control = createElement("input", {
      attrs: {
        id: inputId,
        name: field.name,
        type: inputType,
        placeholder: field.placeholder ?? "",
        min: field.min,
        max: field.max
      }
    });
    control.value = field.type === FIELD_TYPES.ARRAY ? toArrayInputValue(value) : value ?? "";
  }

  control.required = field.required === true;
  control.disabled = disabled;

  control.addEventListener("input", () => emitFieldChange(card, field.name, control.value));
  control.addEventListener("change", () => emitFieldChange(card, field.name, control.value));

  return control;
}

function createInputField(card, field, value) {
  if (field.type === FIELD_TYPES.BOOLEAN) {
    return createBooleanField(card, field, value);
  }

  if (field.type === FIELD_TYPES.ARRAY && Array.isArray(field.options) && field.options.length > 0) {
    return createArrayOptionsField(card, field, value);
  }

  const hasPresetValue = Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0;
  const startsEnabled = !field.requiresToggle || hasPresetValue;
  const control = createStandardControl(card, field, value, !startsEnabled);
  const inputId = control.id;

  const labelChildren = [
    createElement("span", { text: field.label ?? humanize(field.name) })
  ];

  let toggle = null;

  if (field.requiresToggle) {
    const toggleId = `${card.id}-${field.name}-toggle`;
    toggle = createElement("input", {
      attrs: {
        id: toggleId,
        type: "checkbox",
        "aria-label": `Enable ${field.label}`
      }
    });
    toggle.checked = startsEnabled;

    toggle.addEventListener("change", () => {
      control.disabled = !toggle.checked;

      if (!toggle.checked) {
        control.value = "";
        emitFieldChange(card, field.name, "");
      }
    });

    labelChildren.unshift(createElement("label", {
      className: "wizard-field__toggle",
      attrs: { for: toggleId, title: `Enable ${field.label}` },
      children: [toggle, createElement("span", { text: "Override" })]
    }));
  }

  const label = createElement("label", {
    className: "wizard-field__label",
    attrs: { for: inputId },
    children: labelChildren
  });

  return createElement("div", {
    className: `wizard-field${field.requiresToggle ? " wizard-field--toggle-pair" : ""}`,
    dataset: { fieldName: field.name },
    children: [label, control, createHelpText(field)]
  });
}

export function renderWizardGroup({ group, data = {} }) {
  const groupState = evaluateGroupState(group.fields, data);
  const isCollapsed = groupState.isEmpty;
  const card = createElement("article", {
    className: `wizard-card${groupState.isEmpty ? " is-dimmed is-collapsed" : ""}`,
    attrs: {
      id: `wizard-group-${group.id}`,
      "data-state": groupState.isEmpty ? "empty" : "populated"
    }
  });

  const bodyId = `${card.id}-body`;
  const titleId = `${card.id}-title`;

  const toggleButton = createElement("button", {
    className: "wizard-card__header",
    attrs: {
      type: "button",
      "aria-expanded": String(!isCollapsed),
      "aria-controls": bodyId
    }
  });

  toggleButton.appendChild(createElement("span", {
    className: "wizard-card__icon",
    attrs: { "aria-hidden": "true" },
    text: isCollapsed ? "+" : "–"
  }));

  const titleWrap = createElement("span", { className: "wizard-card__title-wrap" });
  titleWrap.appendChild(createElement("span", {
    className: "wizard-card__title",
    attrs: { id: titleId },
    text: group.title
  }));
  titleWrap.appendChild(createElement("span", {
    className: "wizard-card__description",
    text: group.description
  }));

  toggleButton.appendChild(titleWrap);
  toggleButton.appendChild(createElement("span", {
    className: "wizard-card__badge",
    text: group.badge ?? getGroupStateLabel(groupState)
  }));

  const summary = createElement("div", {
    className: "wizard-card__summary",
    text: getGroupStateLabel(groupState)
  });

  const body = createElement("div", {
    className: "wizard-card__body",
    attrs: {
      id: bodyId,
      role: "region",
      "aria-labelledby": titleId
    }
  });

  const fieldList = createElement("div", { className: "wizard-fields" });
  group.fields.forEach((field) => {
    fieldList.appendChild(createInputField(card, field, data[field.name]));
  });
  body.appendChild(fieldList);

  toggleButton.addEventListener("click", () => {
    const expanded = toggleButton.getAttribute("aria-expanded") === "true";
    const nextExpanded = !expanded;

    toggleButton.setAttribute("aria-expanded", String(nextExpanded));
    card.classList.toggle("is-collapsed", !nextExpanded);
    toggleButton.querySelector(".wizard-card__icon").textContent = nextExpanded ? "–" : "+";
  });

  card.appendChild(toggleButton);
  card.appendChild(summary);
  card.appendChild(body);

  return card;
}

export function renderWizardGroups({ groups, data = {}, target }) {
  if (!target) {
    throw new Error("renderWizardGroups requires a target element.");
  }

  target.innerHTML = "";

  groups.forEach((group) => {
    target.appendChild(renderWizardGroup({ group, data }));
  });
}
