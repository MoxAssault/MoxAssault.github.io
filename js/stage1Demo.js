/*
  VPXS YML Creator Redesign
  Stage 1 validation bootstrap

  Temporary sample rendering for the shared wizard module. Later stages will
  replace this data source with Builder and Editor state.
*/

import { YML_FIELD_GROUPS } from "./fields.js";
import { renderWizardGroups } from "./wizardModule.js";

const sampleYmlData = {
  tableVPSId: "2YD0f8I0Y2",
  fps: 60,
  mainNotes: "Stage 1 sample data proving the shared wizard renderer can display populated groups.",
  tagline: "Clean rebuild, same mission.",
  testers: ["Mox", "VPXS Tester"],
  applyFixes: ["bass"],
  enabled: true,
  vpxVPSId: "VPX_SAMPLE",
  vpxChecksum: ["8435FDA49C4DFC2D82B9B361E8AA1155"],
  tableNotes: "VPX sample note. This will become live Builder/Editor data in later stages.",
  backglassBundled: true,
  backglassNotes: "Bundled with the VPX download. Look for the .directb2s file beside the table file.",
  coloredROMVPSId: "CROM_SAMPLE",
  coloredROMChecksum: [
    "8435FDA49C4DFC2D82B9B361E8AA1155",
    "F935FDA49C4DFC2D82B9B361E8AA1199"
  ],
  pupArchiveFormat: "zip"
};

const target = document.querySelector("[data-stage-one-wizard]");
const status = document.querySelector("[data-stage-one-status]");

if (target) {
  renderWizardGroups({
    groups: YML_FIELD_GROUPS,
    data: sampleYmlData,
    target
  });

  target.addEventListener("wizard-field-change", (event) => {
    if (!status) return;

    status.textContent = `Last edited: ${event.detail.fieldName}`;
  });
}
