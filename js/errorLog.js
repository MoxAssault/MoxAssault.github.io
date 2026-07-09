/*
  VPXS YML Creator Redesign
  Stage 2: Inline error log
*/

function createAlert(message, type = "error") {
  const alert = document.createElement("div");
  alert.className = `error-log__item error-log__item--${type}`;
  alert.setAttribute("role", type === "error" ? "alert" : "status");

  const text = document.createElement("p");
  text.textContent = message;

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "error-log__dismiss";
  dismiss.setAttribute("aria-label", "Dismiss message");
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => alert.remove());

  alert.append(text, dismiss);
  return alert;
}

export function createErrorLog(target) {
  if (!target) {
    throw new Error("createErrorLog requires a target element.");
  }

  function push(message, type = "error") {
    target.hidden = false;
    target.prepend(createAlert(message, type));
  }

  function clear() {
    target.innerHTML = "";
    target.hidden = true;
  }

  return {
    clear,
    info(message) {
      push(message, "info");
    },
    success(message) {
      push(message, "success");
    },
    warn(message) {
      push(message, "warning");
    },
    error(errorOrMessage) {
      const message = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage);
      push(message, "error");
    }
  };
}
