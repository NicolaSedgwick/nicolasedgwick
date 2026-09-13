/* Links inside an answer: [label](https://url) in questions.json must become a
   real anchor, open in a new tab, and not flip the card when tapped.

   node tools/tests/link-rendering.test.js
*/

const { check, runAll, gotoCard, flip, flipped, FLIP_MS } = require('./harness');

const LINKED_CARD = 'Care 21';
const LINKED_URL = 'https://www.youtube.com/watch?v=IN88Jp5tRKA';

runAll('Links in answers', async (page) => {
  check('found ' + LINKED_CARD, await gotoCard(page, LINKED_CARD));
  await flip(page);
  check('card flipped to the answer', await flipped(page));

  const txt = await page.textContent('#backText');
  check('no raw markup in the answer text', !/<a\s|href=|\[.*\]\(/i.test(txt), txt.slice(0, 60));

  const link = await page.evaluate(() => {
    const a = document.querySelector('#backText a');
    if (!a) return null;
    const wrap = document.querySelector('#backText .rich');
    return {
      href: a.getAttribute('href'),
      text: a.textContent,
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
      tabIndex: a.tabIndex,
      wrapDisplay: wrap ? getComputedStyle(wrap).display : null,
      underline: getComputedStyle(a).textDecorationLine,
      // it must flow inline in the paragraph, not sit on a line of its own
      inline: (function () {
        const r = a.getClientRects();
        return r.length > 0 && r[r.length - 1].width < document.getElementById('backText').clientWidth;
      })()
    };
  });

  check('anchor exists', !!link);
  if (link) {
    check('href correct', link.href === LINKED_URL, link.href);
    check('label is the link text', link.text === 'YouTube video', link.text);
    check('target=_blank', link.target === '_blank');
    check('rel=noopener noreferrer', link.rel === 'noopener noreferrer', link.rel);
    check('focusable on the showing face', link.tabIndex === 0, 'tabIndex=' + link.tabIndex);
    check('wrapped in one block child (flex layout preserved)', link.wrapDisplay === 'block', link.wrapDisplay);
    check('underlined', link.underline.indexOf('underline') > -1, link.underline);
    check('flows inline with the text', link.inline);
  }

  // tapping the link follows it instead of flipping
  const popup = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
  await page.click('#backText a');
  const opened = await popup;
  check('card stays on the answer side after tapping the link', await flipped(page));
  check('link opened a new tab', !!opened, opened ? 'popup' : 'no popup');
  if (opened) await opened.close();

  // the rest of the card still flips
  await page.click('#backPrompt');
  await page.waitForTimeout(FLIP_MS);
  check('tapping the card body still flips it', !(await flipped(page)));

  // Enter and Space on a focused link leave the card alone
  await flip(page);
  await page.focus('#backText a');
  const popup2 = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
  await page.keyboard.press('Enter');
  const opened2 = await popup2;
  check('Enter on the link does not flip', await flipped(page));
  if (opened2) await opened2.close();
  await page.keyboard.press(' ');
  check('Space on a focused link does not flip', await flipped(page));

  // read-aloud says the label, never the URL
  await page.evaluate(() => { window.__spoken = []; });
  await page.click('.speak[data-face="back"]');
  const spoken = await page.evaluate(() => window.__spoken.join(' | '));
  check('speech omits the URL', !/youtube\.com|https?:/i.test(spoken), spoken.slice(0, 70));
  check('speech says the link label', /YouTube video/.test(spoken));
  check('speech omits the link brackets', !/\[|\]\(/.test(spoken));

  // a link on the hidden face must not be reachable by keyboard
  await page.click('#backPrompt');
  await page.waitForTimeout(FLIP_MS);
  check('link untabbable while the answer face is hidden',
    await page.evaluate(() => document.querySelector('#backText a').tabIndex === -1));

  // answers without links are untouched
  check('found an unlinked card', await gotoCard(page, 'Care 6'));
  const plain = await page.textContent('#backText');
  check('unlinked answers still render', typeof plain === 'string' && plain.length > 0);
  check('no anchors invented in plain answers',
    await page.evaluate(() => !document.querySelector('#backText a')));
});
