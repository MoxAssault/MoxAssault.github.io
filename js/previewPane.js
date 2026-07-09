/*
  VPXS YML Creator Redesign
  Stage 2: Live YML preview pane
*/

import { serializeYml } from "./yamlHelper.js?v=20260709-2";

function debounce(fn, delay = 140) {
  let timer = null;

  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

export function createPreviewPane({ output, status, errorLog }) {
  if (!output) {
    throw new Error("createPreviewPane requires an output element.");
  }

  function render(data) {
    try {
      const yaml = serializeYml(data);
      output.textContent = yaml || "# Fill out the builder fields to generate a preview.";

      if (status) {
        status.textContent = yaml ? "Preview updated" : "Waiting for required table data";
      }
    } catch (error) {
      output.textContent = "# Preview could not be generated.";
      if (status) status.textContent = "Preview error";
      errorLog?.error(error);
    }
  }

  const renderDebounced = debounce(render);

  return {
    render,
    renderDebounced
  };
}
