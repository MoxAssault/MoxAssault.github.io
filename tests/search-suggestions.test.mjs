// The table search's suggestion rows (a Builder user asked, Jason chose the
// layout, 2026-11-17): each row reads "Name  Maker Year" on the left, the
// maker and year smaller and muted so the name still leads, with the VPS ID
// kept on the right. A missing part is left out, and with neither the row is
// the name alone.

import { check, report } from './harness.mjs';
import { openApp } from './browser.mjs';

const DB = [
  { id: 'tafID001', name: 'Addams Family Test', manufacturer: 'Bally', year: 1992, tableFiles: [] },
  { id: 'tafID002', name: 'Addams Family Test Two', manufacturer: 'Williams', tableFiles: [] },
  { id: 'tafID003', name: 'Addams Family Test Three', year: '1994', tableFiles: [] },
  { id: 'tafID004', name: 'Addams Family Test Four', manufacturer: '  ', tableFiles: [] },
  { id: 'tafID005', name: 'Addams Family Test With A Very Long Name That Has To Wrap Somewhere In The Row', manufacturer: 'Gottlieb', year: 1978, tableFiles: [] },
  { id: 'tafID006', name: 'Addams Family Test Six', manufacturer: '  ', year: 1990, tableFiles: [] }
];

for (const [label, theme] of [['dark', 'dark'], ['light', 'light']]) {
  const app = await openApp({ db: DB, windowSize: [1400, 900] });
  try {
    const rows = await app.run(async theme => {
      document.documentElement.setAttribute('data-theme', theme);
      const input = document.getElementById('idInput');
      input.value = 'addams family test';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const list = document.getElementById('suggestions');
      const started = Date.now();
      while (Date.now() - started < 4000 && list.querySelectorAll('.suggestion-item').length < 6) await new Promise(resolve => setTimeout(resolve, 20));
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
      const probe = document.createElement('span');
      probe.style.color = muted;
      document.body.appendChild(probe);
      const mutedRgb = getComputedStyle(probe).color;
      probe.remove();
      const listBox = list.getBoundingClientRect();
      return [...list.querySelectorAll('.suggestion-item')].map(row => {
        const name = row.querySelector('.suggestion-name');
        const maker = row.querySelector('.suggestion-maker');
        const id = row.querySelector('.suggestion-meta');
        const nameRects = name.getClientRects();
        const makerRects = maker ? maker.getClientRects() : [];
        const lastName = nameRects[nameRects.length - 1];
        return {
          name: name.textContent, maker: maker ? maker.textContent : null, id: id.textContent, text: row.textContent,
          makerColour: maker ? getComputedStyle(maker).color : null, idColour: getComputedStyle(id).color, mutedRgb,
          makerSize: maker ? parseFloat(getComputedStyle(maker).fontSize) : null, nameSize: parseFloat(getComputedStyle(name).fontSize),
          makerOneLine: makerRects.length <= 1, makerKeptWhole: maker ? getComputedStyle(maker).whiteSpace === 'nowrap' : null,
          makerBesideName: maker ? Math.abs(makerRects[0].top - lastName.top) <= 4 && makerRects[0].left >= lastName.right : null,
          idRight: id.getBoundingClientRect().right <= listBox.right + 0.5 && id.getBoundingClientRect().left > (maker || name).getBoundingClientRect().right,
          height: Math.round(row.getBoundingClientRect().height)
        };
      });
    }, theme);
    const J = JSON.stringify;
    const [both, makerOnly, yearOnly, blank, long, blankWithYear] = rows;
    check(`${label}: six rows for the search`, rows.length === 6, J(rows));
    check(`${label}: the maker and year follow the name, the ID stays on the right`, both.name === 'Addams Family Test' && both.maker === 'Bally 1992' && both.id === 'tafID001' && both.makerBesideName && both.idRight, J(both));
    check(`${label}: read aloud with spaces between the parts`, both.text.includes('Addams Family Test Bally 1992'), both.text);
    check(`${label}: only a maker, or only a year, shows that part alone`, makerOnly.maker === 'Williams' && yearOnly.maker === '1994', J([makerOnly, yearOnly]));
    check(`${label}: a blank maker with a year shows the year alone`, blankWithYear.maker === '1990', J(blankWithYear));
    check(`${label}: neither (or a blank maker), and the row is the name alone`, blank.maker === null && blank.text === 'Addams Family Test FourtafID004', J(blank));
    check(`${label}: the maker and year are smaller than the name and in the muted text colour`, both.makerSize < both.nameSize && both.makerColour === both.mutedRgb, J(both));
    check(`${label}: the ID is in the muted text colour too (the faint one failed AA text contrast)`, rows.every(r => r.idColour === r.mutedRgb), J(rows.map(r => [r.idColour, r.mutedRgb])));
    check(`${label}: a short name keeps the row on one line`, both.height === makerOnly.height && both.height < 44, J(rows.map(r => r.height)));
    check(`${label}: a long name wraps before the maker, which stays whole, and the ID stays in the list`, long.makerOneLine && long.makerKeptWhole && long.idRight && long.height > both.height, J(long));
  } finally {
    await app.close();
  }
}

report();
