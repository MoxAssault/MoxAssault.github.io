/*
  VPXS YML Creator Redesign
  Stage 1: Field definitions

  This module is the source of truth for the shared wizard renderer. Builder
  and Editor modes will both consume these same group definitions.
*/

const CHECKSUM_HELP = "MD5 checksum. Multiple values may be entered as a comma-separated list.";

export const FIELD_TYPES = Object.freeze({
  ARRAY: "array",
  BOOLEAN: "boolean",
  NUMBER: "number",
  SELECT: "select",
  TEXT: "text",
  TEXTAREA: "textarea",
  URL: "url"
});

export const PUP_ARCHIVE_OPTIONS = Object.freeze([
  { value: "", label: "Default (zip)" },
  { value: "zip", label: "ZIP" },
  { value: "rar", label: "RAR" },
  { value: "7z", label: "7Z" }
]);

export const BASE_FIELDS = Object.freeze([
  {
    name: "tableVPSId",
    label: "Table VPS ID",
    type: FIELD_TYPES.TEXT,
    required: true,
    placeholder: "Example: 2YD0f8I0Y2"
  },
  {
    name: "fps",
    label: "FPS",
    type: FIELD_TYPES.NUMBER,
    required: true,
    min: 1,
    max: 240,
    placeholder: "60"
  },
  {
    name: "mainNotes",
    label: "Main Notes",
    type: FIELD_TYPES.TEXTAREA,
    required: true,
    placeholder: "General notes displayed above all download inputs."
  },
  {
    name: "tagline",
    label: "Tagline",
    type: FIELD_TYPES.TEXTAREA,
    required: true,
    placeholder: "Short quote or message for the table."
  },
  {
    name: "testers",
    label: "Testers",
    type: FIELD_TYPES.ARRAY,
    required: true,
    placeholder: "CoffeeAtJoes, OminousOsie"
  },
  {
    name: "applyFixes",
    label: "Apply Fixes",
    type: FIELD_TYPES.ARRAY,
    options: [{ value: "bass", label: "BASS" }],
    placeholder: "bass"
  },
  {
    name: "enabled",
    label: "Enable for Wizard",
    type: FIELD_TYPES.BOOLEAN
  },
  {
    name: "tableNameOverride",
    label: "Table Name Override",
    type: FIELD_TYPES.TEXT,
    requiresToggle: true,
    placeholder: "Only when the VPS name is wrong or misleading."
  },
  {
    name: "tableManufacturerOverride",
    label: "Manufacturer Override",
    type: FIELD_TYPES.TEXT,
    requiresToggle: true,
    placeholder: "Only when the VPS manufacturer needs correcting."
  },
  {
    name: "tableYearOverride",
    label: "Year Override",
    type: FIELD_TYPES.NUMBER,
    requiresToggle: true,
    min: 1900,
    max: 2100,
    placeholder: "1992"
  }
]);

export const VPX_FIELDS = Object.freeze([
  {
    name: "vpxVPSId",
    label: "VPX VPS ID",
    type: FIELD_TYPES.TEXT,
    required: true,
    placeholder: "Selected .vpx file ID"
  },
  {
    name: "vpxChecksum",
    label: "VPX Checksum",
    type: FIELD_TYPES.ARRAY,
    required: true,
    placeholder: "8435FDA49C4DFC2D82B9B361E8AA1155",
    help: CHECKSUM_HELP
  },
  {
    name: "tableNotes",
    label: "VPX Notes",
    type: FIELD_TYPES.TEXTAREA,
    placeholder: "Notes displayed next to the .vpx download button."
  }
]);

export const BACKGLASS_FIELDS = Object.freeze([
  {
    name: "backglassVPSId",
    label: "Backglass VPS ID",
    type: FIELD_TYPES.TEXT,
    placeholder: "Selected .directb2s file ID"
  },
  {
    name: "backglassBundled",
    label: "Backglass Bundled with VPX",
    type: FIELD_TYPES.BOOLEAN
  },
  {
    name: "backglassChecksum",
    label: "Backglass Checksum",
    type: FIELD_TYPES.ARRAY,
    placeholder: "8435FDA49C4DFC2D82B9B361E8AA1155",
    help: CHECKSUM_HELP
  },
  {
    name: "backglassNotes",
    label: "Backglass Notes",
    type: FIELD_TYPES.TEXTAREA,
    placeholder: "Required when the backglass is bundled."
  },
  {
    name: "backglassAuthorsOverride",
    label: "Authors Override",
    type: FIELD_TYPES.ARRAY,
    requiresToggle: true,
    placeholder: "CoffeeAtJoes"
  },
  {
    name: "backglassImageOverride",
    label: "Image Override",
    type: FIELD_TYPES.URL,
    requiresToggle: true,
    placeholder: "https://..."
  },
  {
    name: "backglassUrlOverride",
    label: "URL Override",
    type: FIELD_TYPES.URL,
    requiresToggle: true,
    placeholder: "https://..."
  }
]);

export const COLORED_ROM_FIELDS = Object.freeze([
  {
    name: "coloredROMVPSId",
    label: "Color ROM VPS ID",
    type: FIELD_TYPES.TEXT,
    placeholder: "Selected color ROM / serum ID"
  },
  {
    name: "coloredROMBundled",
    label: "Color ROM Bundled with VPX",
    type: FIELD_TYPES.BOOLEAN
  },
  {
    name: "coloredROMChecksum",
    label: "Color ROM Checksum",
    type: FIELD_TYPES.ARRAY,
    placeholder: "One checksum, or PAL/VNI checksums separated by commas",
    help: CHECKSUM_HELP
  },
  {
    name: "coloredROMNotes",
    label: "Color ROM Notes",
    type: FIELD_TYPES.TEXTAREA,
    placeholder: "Required when the color ROM is bundled."
  },
  {
    name: "coloredROMUrlOverride",
    label: "URL Override",
    type: FIELD_TYPES.URL,
    requiresToggle: true,
    placeholder: "https://..."
  },
  {
    name: "coloredROMVersionOverride",
    label: "Version Override",
    type: FIELD_TYPES.TEXT,
    requiresToggle: true,
    placeholder: "ROM name without .zip/.c7z/.pal/.vni"
  }
]);

export const DIFF_FIELDS = Object.freeze([
  {
    name: "diffVPSId",
    label: "VPU Patch VPS ID",
    type: FIELD_TYPES.TEXT,
    placeholder: "Selected .dif patch ID"
  },
  {
    name: "diffChecksum",
    label: "VPU Patch Checksum",
    type: FIELD_TYPES.ARRAY,
    placeholder: "8435FDA49C4DFC2D82B9B361E8AA1155",
    help: CHECKSUM_HELP
  },
  {
    name: "diffNotes",
    label: "VPU Patch Notes",
    type: FIELD_TYPES.TEXTAREA,
    placeholder: "Notes displayed next to the patch download button."
  },
  {
    name: "diffUrlOverride",
    label: "URL Override",
    type: FIELD_TYPES.URL,
    requiresToggle: true,
    placeholder: "https://..."
  },
  {
    name: "diffVersionOverride",
    label: "Version Override",
    type: FIELD_TYPES.TEXT,
    requiresToggle: true,
    placeholder: "Patch version or expected filename stem"
  }
]);

export const PUP_FIELDS = Object.freeze([
  {
    name: "pupVPSId",
    label: "PUP Pack VPS ID",
    type: FIELD_TYPES.TEXT,
    placeholder: "Selected PUP pack ID"
  },
  {
    name: "pupBundled",
    label: "PUP Pack Bundled with VPX",
    type: FIELD_TYPES.BOOLEAN
  },
  {
    name: "pupRequired",
    label: "PUP Pack Required",
    type: FIELD_TYPES.BOOLEAN
  },
  {
    name: "pupChecksum",
    label: "PUP Pack Checksum",
    type: FIELD_TYPES.ARRAY,
    placeholder: "8435FDA49C4DFC2D82B9B361E8AA1155",
    help: CHECKSUM_HELP
  },
  {
    name: "pupFileUrl",
    label: "PUP File URL",
    type: FIELD_TYPES.URL,
    placeholder: "https://..."
  },
  {
    name: "pupVersion",
    label: "PUP Version / Folder Name",
    type: FIELD_TYPES.TEXT,
    placeholder: "Folder name without .zip/.rar/.7z"
  },
  {
    name: "pupArchiveFormat",
    label: "PUP Archive Format",
    type: FIELD_TYPES.SELECT,
    options: PUP_ARCHIVE_OPTIONS
  },
  {
    name: "pupArchiveRoot",
    label: "PUP Archive Root",
    type: FIELD_TYPES.TEXT,
    placeholder: "TableMedia/PupFiles/"
  },
  {
    name: "pupNotes",
    label: "PUP Pack Notes",
    type: FIELD_TYPES.TEXTAREA,
    placeholder: "Required when the PUP pack is bundled."
  }
]);

export const ROM_FIELDS = Object.freeze([
  {
    name: "romVPSId",
    label: "ROM VPS ID",
    type: FIELD_TYPES.TEXT,
    placeholder: "Selected ROM ID"
  },
  {
    name: "romBundled",
    label: "ROM Bundled with VPX",
    type: FIELD_TYPES.BOOLEAN
  },
  {
    name: "romChecksum",
    label: "ROM Checksum",
    type: FIELD_TYPES.ARRAY,
    placeholder: "8435FDA49C4DFC2D82B9B361E8AA1155",
    help: CHECKSUM_HELP
  },
  {
    name: "romNotes",
    label: "ROM Notes",
    type: FIELD_TYPES.TEXTAREA,
    placeholder: "Required when the ROM is bundled."
  },
  {
    name: "romUrlOverride",
    label: "URL Override",
    type: FIELD_TYPES.URL,
    requiresToggle: true,
    placeholder: "https://..."
  },
  {
    name: "romVersionOverride",
    label: "Version Override",
    type: FIELD_TYPES.TEXT,
    requiresToggle: true,
    placeholder: "ROM name without .zip/.rar/.7z"
  }
]);

export const YML_FIELD_GROUPS = Object.freeze([
  {
    id: "base",
    title: "Base",
    badge: "Required core",
    description: "Overall table metadata shared by every generated YML file.",
    fields: BASE_FIELDS
  },
  {
    id: "vpx",
    title: "VPX",
    badge: ".vpx",
    description: "The playable Visual Pinball table file.",
    fields: VPX_FIELDS
  },
  {
    id: "backglass",
    title: "Backglass",
    badge: ".directb2s",
    description: "Backglass metadata, bundled state, overrides, and checksum values.",
    fields: BACKGLASS_FIELDS
  },
  {
    id: "colored-rom",
    title: "Colored ROM",
    badge: ".cRom / .vni / .pal",
    description: "Color ROM or serum package details, including multiple checksum support.",
    fields: COLORED_ROM_FIELDS
  },
  {
    id: "diff",
    title: "VPU Patch",
    badge: ".dif",
    description: "Patch file metadata for parent/child VPX table releases.",
    fields: DIFF_FIELDS
  },
  {
    id: "pup",
    title: "PUP Pack",
    badge: ".zip / .rar / .7z",
    description: "PUP pack URL, archive, checksum, required state, and notes.",
    fields: PUP_FIELDS
  },
  {
    id: "rom",
    title: "ROM",
    badge: ".zip / .rar / .7z",
    description: "ROM metadata, bundled state, overrides, and checksum values.",
    fields: ROM_FIELDS
  }
]);

export function getFieldByName(fieldName) {
  return YML_FIELD_GROUPS
    .flatMap((group) => group.fields)
    .find((field) => field.name === fieldName) ?? null;
}
