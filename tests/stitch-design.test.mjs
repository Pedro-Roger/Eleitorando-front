import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('uses the Stitch design tokens', () => {
  const css = read('src/styles.css');

  assert.match(css, /--primary:\s*#003fb1/i);
  assert.match(css, /--background:\s*#faf8ff/i);
  assert.match(css, /--outline-variant:\s*#c3c5d7/i);
  assert.match(css, /family=Inter/);
  assert.match(css, /Material\+Symbols\+Outlined/);
});

test('provides shared Stitch navigation components', () => {
  const header = read('src/components/AppHeader.jsx');
  const icon = read('src/components/Icon.jsx');
  const tabBar = read('src/components/TabBar.jsx');

  assert.match(header, /className="app-header"/);
  assert.match(icon, /material-symbols-outlined/);
  for (const label of ['Início', 'Equipe', 'Eleitores', 'Demográfico', 'Perfil']) {
    assert.match(tabBar, new RegExp(label));
  }
});

test('main Stitch screens use the shared header', () => {
  for (const page of ['Home', 'Team', 'Voters', 'Panel', 'Reports', 'Profile']) {
    assert.match(read(`src/pages/${page}.jsx`), /<AppHeader/);
  }
});

test('interactive Stitch components keep keyboard and form semantics', () => {
  const sheet = read('src/components/BottomSheet.jsx');
  const team = read('src/pages/Team.jsx');

  assert.match(sheet, /event\.key === 'Escape'/);
  assert.match(sheet, /aria-labelledby=/);
  assert.match(team, /className="card card-button team-card tappable"/);
  assert.match(team, /type="password"[\s\S]*value=\{resetPw\}/);
});

test('voter search ignores stale responses', () => {
  assert.match(read('src/pages/Voters.jsx'), /loadRequest\.current/);
});
