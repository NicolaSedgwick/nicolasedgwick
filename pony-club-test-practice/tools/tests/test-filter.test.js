/* The Test filter and the test-level label on the question side.

   Counts come from data/questions.json rather than being hard-coded, so this
   keeps working as test_level is widened across the deck.

   node tools/tests/test-filter.test.js
*/

const fs = require('fs');
const path = require('path');
const { check, runAll, gotoCard, flipped, deckTotal, FLIP_MS } = require('./harness');

const ORDER = ['D', 'D+', 'C', 'C+', 'B', 'A'];
const cards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'data', 'questions.json'), 'utf8')).cards;

const levelsOf = c => (c.test_level || []);
const expected = {};
cards.forEach(c => levelsOf(c).forEach(l => { expected[l] = (expected[l] || 0) + 1; }));
const levels = Object.keys(expected).sort((a, b) => {
  const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a < b ? -1 : a > b ? 1 : 0;
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
});

// a card carrying more than one level, for the label check
const multi = cards.filter(c => levelsOf(c).length > 1)[0];
const single = cards.filter(c => levelsOf(c).length === 1)[0];
const refOf = c => c.theme + ' ' + c.number;

runAll('Test filter and label', async (page) => {
  // --- the control ---
  check('Test field is shown', !(await page.evaluate(() => document.getElementById('testField').hidden)));
  const opts = await page.$$eval('#test option', o => o.map(x => x.value + '|' + x.textContent));
  const want = [''].concat(levels).map(l => l ? l + '|' + l + ' test' : '|All tests');
  check('options match the data, in Pony Club order', opts.join(' ') === want.join(' '), opts.join(' '));
  check('defaults to all tests', (await page.inputValue('#test')) === '');
  check('deck starts at the full ' + cards.length, (await deckTotal(page)) === cards.length, await deckTotal(page));

  // --- one deck per level ---
  for (const l of levels) {
    await page.selectOption('#test', l);
    const got = await deckTotal(page);
    check(l + ' test -> ' + expected[l] + ' card(s)', got === expected[l], got);
  }

  // --- topics narrow with the test, so no empty combinations ---
  await page.selectOption('#test', levels[0]);
  const shown = await page.$$eval('#topic option', o => o.map(x => x.textContent).slice(1));
  const should = [];
  cards.filter(c => levelsOf(c).indexOf(levels[0]) > -1)
    .forEach(c => { if (should.indexOf(c.topic) === -1) should.push(c.topic); });
  check('topic list narrows to the chosen test',
    shown.slice().sort().join(',') === should.slice().sort().join(','), shown.join(','));

  // --- stacks with the other filters ---
  const lvl = levelsOf(multi)[0];
  const matching = cards.filter(c => levelsOf(c).indexOf(lvl) > -1 && c.theme === multi.theme);
  await page.selectOption('#test', lvl);
  await page.selectOption('#theme', multi.theme);
  check('test + theme together -> ' + matching.length,
    (await deckTotal(page)) === matching.length, await deckTotal(page));
  await page.click('.switch__label');            // the checkbox is visually hidden behind the switch
  const alsoImportant = matching.filter(c => c.important === 'Yes').length;
  check('important-only stacks on top -> ' + alsoImportant,
    (await deckTotal(page)) === alsoImportant, await deckTotal(page));

  // --- reset ---
  check('Reset is enabled while a test is chosen',
    !(await page.evaluate(() => document.getElementById('reset').disabled)));
  await page.click('#reset');
  check('Reset clears the test filter', (await page.inputValue('#test')) === '');
  check('Reset restores the full deck', (await deckTotal(page)) === cards.length, await deckTotal(page));
  check('Reset disables itself again', await page.evaluate(() => document.getElementById('reset').disabled));

  // --- the label on the question side ---
  const readTag = () => page.evaluate(() => {
    const t = document.getElementById('frontTests');
    return { text: t.textContent, hidden: t.hidden, aria: t.getAttribute('aria-label') };
  });

  check('found the multi-test card', await gotoCard(page, refOf(multi)));
  const tag = await readTag();
  check('multi-test label reads in order', tag.text === levelsOf(multi).join(' · '), tag.text);
  check('multi-test label is visible', !tag.hidden);
  check('multi-test label has a spoken form', /^Applies to the .+ tests$/.test(tag.aria || ''), tag.aria);

  check('found a single-test card', await gotoCard(page, refOf(single)));
  const one = await readTag();
  check('single-test label reads the level', one.text === levelsOf(single)[0], one.text);
  check('single-test label is visible', !one.hidden);
  check('single-test spoken form', one.aria === 'Applies to the ' + levelsOf(single)[0] + ' test', one.aria);

  // --- the label lives on the question side and doesn't break the tap target ---
  check('label is on the front face',
    await page.evaluate(() => document.querySelector('.card__face--front #frontTests') !== null));
  await page.click('#frontTests');
  await page.waitForTimeout(FLIP_MS);
  check('tapping the label still flips the card', await flipped(page));
});
