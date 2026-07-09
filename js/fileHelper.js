/*
  VPXS YML Creator Redesign
  Stage 4: File helper for Editor mode
*/

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file was selected."));
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("Unable to read the selected file.")));
    reader.readAsText(file);
  });
}

export function isLikelyYmlFile(file) {
  if (!file) return false;
  const name = String(file.name ?? "").toLowerCase();
  return name.endsWith(".yml") || name.endsWith(".yaml") || file.type === "text/yaml";
}

export function getEditorDownloadName(fileName = "table-config.yml") {
  const cleanName = String(fileName || "table-config.yml").trim();

  if (cleanName.endsWith(".yml") || cleanName.endsWith(".yaml")) {
    return cleanName;
  }

  return `${cleanName}.yml`;
}
