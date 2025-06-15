const YML_FIELDS = [
  {name: 'applyFixes',                type: 'array'},
  {name: 'backglassAuthorsOverride',  type: 'array'},
  {name: 'backglassBundled',          type: 'bool'},
  {name: 'backglassChecksum',         type: 'str'},
  {name: 'backglassImageOverride',    type: 'str'},
  {name: 'backglassNotes',            type: 'str'},
  {name: 'backglassUrlOverride',      type: 'str'},
  {name: 'backglassVPSId',            type: 'str'},
  {name: 'coloredROMBundled',         type: 'bool'},
  {name: 'coloredROMChecksum',        type: 'str'},
  {name: 'coloredROMNotes',           type: 'str'},
  {name: 'coloredROMUrlOverride',     type: 'str'},
  {name: 'coloredROMVersionOverride', type: 'str'},
  {name: 'coloredROMVPSId',           type: 'str'},
  {name: 'enabled',                   type: 'bool'},
  {name: 'fps',                       type: 'int'},
  {name: 'mainNotes',                 type: 'str', multiline: true},
  {name: 'pupArchiveFormat',          type: 'str'},
  {name: 'pupArchiveRoot',            type: 'str'},
  {name: 'pupChecksum',               type: 'str'},
  {name: 'pupFileUrl',                type: 'str'},
  {name: 'pupNotes',                  type: 'str'},
  {name: 'pupRequired',               type: 'bool'},
  {name: 'pupVersion',                type: 'str'},
  {name: 'romBundled',                type: 'bool'},
  {name: 'romChecksum',               type: 'str'},
  {name: 'romNotes',                  type: 'str'},
  {name: 'romUrlOverride',            type: 'str'},
  {name: 'romVersionOverride',        type: 'str'},
  {name: 'romVPSId',                  type: 'str'},
  {name: 'tableNameOverride',         type: 'str'},
  {name: 'tableNotes',                type: 'str'},
  {name: 'tableVPSId',                type: 'str'},
  {name: 'tagline',                   type: 'str', multiline: true},
  {name: 'testers',                   type: 'array'},
  {name: 'vpxChecksum',               type: 'str'},
  {name: 'vpxVPSId',                  type: 'str'},
];
const YML_MANDATORY_FIELDS = [
  {name: 'applyFixes', type: 'array'},
  {name: 'enabled',    type: 'bool'},
  {name: 'fps',        type: 'int'},
  {name: 'mainNotes',  type: 'str', multiline: true},
  {name: 'tagline',    type: 'str', multiline: true},
  {name: 'testers',    type: 'array'}
];
const YML_BUNDLE_FIELDS = [
  {name: 'backglassBundled', type: 'bool'},
  {name: 'romBundled',       type: 'bool'},
  {name: 'coloredROMBundled',type: 'bool'}
];
const TABLE_FIELDS = [
  {name: 'tableVPSId',        type: 'str'},
  {name: 'tableNotes',        type: 'str'},
  {name: 'tableNameOverride', type: 'str'}
];
const VPX_FIELDS = [
  {name: 'vpxVPSId',   type: 'str'},
  {name: 'vpxChecksum',type: 'str'}
];
const B2S_FIELDS = [
  {name: 'backglassVPSId',         type: 'str'},
  {name: 'backglassChecksum',      type: 'str'},
  {name: 'backglassNotes',         type: 'str'},
  {name: 'backglassAuthorsOverride',type:'array'},
  {name: 'backglassImageOverride', type: 'str'},
  {name: 'backglassUrlOverride',   type: 'str'}
];
const ROM_FIELDS = [
  {name: 'romVPSId',         type: 'str'},
  {name: 'romChecksum',      type: 'str'},
  {name: 'romNotes',         type: 'str'},
  {name: 'romUrlOverride',   type: 'str'},
  {name: 'romVersionOverride',type:'str'}
];
const COLOR_ROM_FIELDS = [
  {name: 'coloredROMVPSId',         type: 'str'},
  {name: 'coloredROMChecksum',      type: 'str'},
  {name: 'coloredROMNotes',         type: 'str'},
  {name: 'coloredROMUrlOverride',   type: 'str'},
  {name: 'coloredROMVersionOverride',type:'str'}
];
const PUP_FIELDS = [
  {name: 'pupRequired',     type: 'bool'},
  {name: 'pupVersion',      type: 'str'},
  {name: 'pupChecksum',     type: 'str'},
  {name: 'pupNotes',        type: 'str'},
  {name: 'pupFileUrl',      type: 'str'},
  {name: 'pupArchiveFormat',type: 'str'},
  {name: 'pupArchiveRoot',  type: 'str'}
];

window.YML_FIELDS = YML_FIELDS;
window.YML_MANDATORY_FIELDS = YML_MANDATORY_FIELDS;
window.YML_BUNDLE_FIELDS = YML_BUNDLE_FIELDS;
window.TABLE_FIELDS = TABLE_FIELDS;
window.VPX_FIELDS = VPX_FIELDS;
window.B2S_FIELDS = B2S_FIELDS;
window.ROM_FIELDS = ROM_FIELDS;
window.COLOR_ROM_FIELDS = COLOR_ROM_FIELDS;
window.PUP_FIELDS = PUP_FIELDS;
