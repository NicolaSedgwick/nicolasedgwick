/* Pictures in questions: ![alt](images/file.jpg) in questions.json must become
   a real <img> on the card — loaded, sized to fit, alt text set, not spoken
   aloud, and never shown as raw syntax.

   node tools/tests/image-rendering.test.js
*/

const { check, runAll, flip, FLIP_MS } = require('./harness');

const IMAGE_FILE = 'c34-farrier-tool.jpg';

/* Card references aren't unique any more, so find the card by its picture. */
async function gotoImageCard(page) {
  const total = parseInt((await page.textContent('#counter')).split('/')[1], 10);
  for (let i = 0; i < total; i++) {
    if (await page.$('#frontText img')) return true;
    await page.click('#next');
  }
  return false;
}

runAll('Images in questions', async (page) => {
  check('found the picture card', await gotoImageCard(page));

  const front = await page.evaluate(() => {
    const box = document.getElementById('frontText');
    const img = box.querySelector('img');
    if (!img) return null;
    return {
      text: box.textContent,
      alt: img.getAttribute('alt'),
      src: img.getAttribute('src'),
      inRich: !!img.closest('.rich'),
      loaded: img.complete && img.naturalWidth > 0,
      fits: img.getBoundingClientRect().width <= box.clientWidth + 1,
      height: img.getBoundingClientRect().height,
      display: getComputedStyle(img).display
    };
  });

  check('image element exists on the question side', !!front);
  if (front) {
    check('no raw syntax left in the text', !/!\[|\]\(|<img/i.test(front.text), front.text);
    check('question wording kept', /Name this farrier tool/.test(front.text), front.text);
    check('alt text is the file name', front.alt === IMAGE_FILE, front.alt);
    check('src points at the picture', /c34-farrier-tool\.jpg$|^data:image\/jpeg;base64,/.test(front.src), front.src.slice(0, 40));
    check('image actually loaded', front.loaded);
    check('inside the single block wrapper', front.inRich);
    check('on a line of its own', front.display === 'block', front.display);
    check('no wider than the card', front.fits);
    check('height capped', front.height > 40 && front.height <= 13 * 16 + 1, Math.round(front.height) + 'px');
  }

  await page.click('.speak[data-face="front"]');
  const spoken = await page.evaluate(() => window.__spoken[window.__spoken.length - 1] || '');
  check('read-aloud says the question', /Name this farrier tool/.test(spoken), spoken);
  check('read-aloud skips the picture', !/jpg|images\/|!\[|\]\(/.test(spoken), spoken);
  await page.click('.speak[data-face="front"]');     // stop

  await page.click('#frontText img');                 // tapping the picture flips like the rest of the card
  await page.waitForTimeout(FLIP_MS);
  check('tapping the picture flips the card', await page.evaluate(() => document.getElementById('card').classList.contains('is-flipped')));

  const back = await page.evaluate(() => {
    const img = document.querySelector('#backPrompt img');
    return img ? { h: img.getBoundingClientRect().height, alt: img.alt, text: document.getElementById('backPrompt').textContent } : null;
  });
  check('thumbnail repeated beside the answer', !!back);
  if (back) {
    check('thumbnail is small', back.h > 0 && back.h <= 4.5 * 16 + 1, Math.round(back.h) + 'px');
    check('no raw syntax on the answer side', !/!\[|\]\(/.test(back.text), back.text);
  }
  check('answer shows', /Rasp/.test(await page.textContent('#backText')));
});
