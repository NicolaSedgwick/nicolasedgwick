/* Pony Club C Test Practice
   Vanilla JS. No build step, no storage, no network calls once the page and its
   questions have loaded. */

(function () {
  'use strict';

  var DATA_URL = 'data/questions.json';
  var EMPTY_ANSWER = 'No answer recorded yet — say it out loud in your own words, then check against your Manual of Horsemanship.';

  var el = {
    testField: document.getElementById('testField'),
    test: document.getElementById('test'),
    theme: document.getElementById('theme'),
    topic: document.getElementById('topic'),
    important: document.getElementById('importantOnly'),
    shuffle: document.getElementById('shuffle'),
    reset: document.getElementById('reset'),
    voiceField: document.getElementById('voiceField'),
    status: document.getElementById('status'),
    card: document.getElementById('card'),
    frontTheme: document.getElementById('frontTheme'),
    frontTopic: document.getElementById('frontTopic'),
    frontTests: document.getElementById('frontTests'),
    frontImportant: document.getElementById('frontImportant'),
    frontText: document.getElementById('frontText'),
    backRef: document.getElementById('backRef'),
    backPrompt: document.getElementById('backPrompt'),
    backText: document.getElementById('backText'),
    prev: document.getElementById('prev'),
    next: document.getElementById('next'),
    counter: document.getElementById('counter')
  };

  var allCards = [];
  var deck = [];
  var index = 0;

  /* ---------- data ---------- */

  function start(data) {
    allCards = (data && data.cards) || [];
    if (!allCards.length) throw new Error('no cards in file');
    populateTests();
    populateThemes();
    populateTopics();
    buildDeck();
    bind();
    setUpVoices();
  }

  function failed(err) {
    el.status.textContent = 'Could not load the questions (' + err.message +
      '). If you opened this file directly from your computer, serve the folder over http instead.';
    document.body.classList.add('empty');
  }

  // NB: boot() is called at the very bottom of this file, never here. In the
  // single-file build the data is already in the page, so start() would run
  // synchronously at this point — before the `var`s further down have been
  // assigned — and quietly skip the voice setup.
  function boot() {
    if (window.PC_DATA) {               // single-file build: data is already here
      try { start(window.PC_DATA); } catch (err) { failed(err); }
      return;
    }
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(start)
      .catch(failed);
  }

  /* ---------- filters ---------- */

  function unique(list) {
    var seen = {}, out = [];
    list.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }

  // Standard Pony Club progression; anything unrecognised sorts to the end.
  var TEST_ORDER = ['D', 'D+', 'C', 'C+', 'B', 'A'];

  function testsOf(card) {
    var t = card.test_level;
    if (!t) return [];
    return (Object.prototype.toString.call(t) === '[object Array]' ? t : [t])
      .filter(function (v) { return !!v; });
  }

  function byTestOrder(a, b) {
    var ia = TEST_ORDER.indexOf(a), ib = TEST_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a < b ? -1 : a > b ? 1 : 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }

  function matchesTest(card) {
    return !el.test.value || testsOf(card).indexOf(el.test.value) > -1;
  }

  function populateTests() {
    var levels = [];
    allCards.forEach(function (c) {
      testsOf(c).forEach(function (l) { if (levels.indexOf(l) === -1) levels.push(l); });
    });
    levels.sort(byTestOrder).forEach(function (l) {
      el.test.appendChild(new Option(l + ' test', l));
    });
    // One test in the file is not a choice — same rule as the voice control.
    el.testField.hidden = levels.length < 2;
  }

  function populateThemes() {
    unique(allCards.map(function (c) { return c.theme; })).forEach(function (t) {
      el.theme.appendChild(new Option(t, t));
    });
  }

  function populateTopics() {
    var wanted = el.theme.value;
    var current = el.topic.value;
    var topics = unique(allCards
      .filter(function (c) { return (!wanted || c.theme === wanted) && matchesTest(c); })
      .map(function (c) { return c.topic; }));

    el.topic.length = 1;
    topics.forEach(function (t) { el.topic.appendChild(new Option(t, t)); });
    el.topic.value = topics.indexOf(current) > -1 ? current : '';
  }

  function filtered() {
    return allCards.filter(function (c) {
      if (!matchesTest(c)) return false;
      if (el.theme.value && c.theme !== el.theme.value) return false;
      if (el.topic.value && c.topic !== el.topic.value) return false;
      if (el.important.checked && c.important !== 'Yes') return false;
      return true;
    });
  }

  function shuffleInPlace(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildDeck() {
    deck = shuffleInPlace(filtered());
    index = 0;
    el.reset.disabled = isDefaultFilters();
    render();
  }

  function isDefaultFilters() {
    return !el.test.value && !el.theme.value && !el.topic.value && !el.important.checked;
  }

  function resetFilters() {
    el.test.value = '';
    el.theme.value = '';
    el.important.checked = false;
    populateTopics();          // rebuilds the topic list, then clears it
    el.topic.value = '';
    buildDeck();
  }

  /* ---------- rendering ---------- */

  // Questions and answers are plain text, not HTML. Two bits of syntax in
  // questions.json become real elements:
  //   [label](https://url)            -> a link
  //   ![alt](images/file.jpg)         -> a picture (or an https:// address)
  // Nothing is ever inserted as markup, so a stray angle bracket stays a stray
  // angle bracket. Images are matched first so their brackets aren't read as a
  // link. data:image/... is allowed only because the single-file build swaps
  // images/ paths for inlined copies.
  var LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  var IMAGE_RE = /!\[([^\]]*)\]\(((?:images\/|https:\/\/|data:image\/(?:jpeg|png|gif|webp);base64,)[^\s)]+)\)/g;
  var RICH_RE = new RegExp(IMAGE_RE.source + '|' + LINK_RE.source, 'g');

  function fileNameOf(src) {
    if (/^data:/.test(src)) return 'image';
    return decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() || 'image');
  }

  function renderRich(text, target) {
    target.textContent = '';
    // .card__text is a flex container, so everything goes inside one block
    // child; loose text nodes would each become their own flex item.
    var wrap = document.createElement('span');
    wrap.className = 'rich';
    var last = 0, m, afterImage = false;
    text = String(text);
    RICH_RE.lastIndex = 0;

    function addText(t) {
      // A picture sits on its own line, so the line break and spaces written
      // around it in the JSON would only add an empty line.
      if (afterImage) t = t.replace(/^\s+/, '');
      if (t) wrap.appendChild(document.createTextNode(t));
    }

    while ((m = RICH_RE.exec(text)) !== null) {
      var before = text.slice(last, m.index);
      if (m[2]) {                                   // ![alt](src)
        addText(before.replace(/\s+$/, ''));
        var img = document.createElement('img');
        img.className = 'card__image';
        img.src = m[2];
        img.alt = m[1] || fileNameOf(m[2]);
        img.decoding = 'async';
        img.draggable = false;
        wrap.appendChild(img);
        afterImage = true;
      } else {                                      // [label](https://url)
        addText(before);
        var a = document.createElement('a');
        a.href = m[4];
        a.textContent = m[3];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        wrap.appendChild(a);
        afterImage = false;
      }
      last = m.index + m[0].length;
    }
    addText(text.slice(last));
    target.appendChild(wrap);
  }

  // For read-aloud: say a link's label, not its URL, and skip pictures
  // entirely — reading the file name out would give the answer away.
  function plainText(text) {
    return String(text)
      .replace(IMAGE_RE, ' ')
      .replace(LINK_RE, '$1')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function setFlipped(on) {
    on = !!on;
    el.card.classList.toggle('is-flipped', on);
    el.card.setAttribute('aria-label', on
      ? 'Flashcard, answer side. Activate to turn back to the question.'
      : 'Flashcard, question side. Activate to turn the card over.');

    // Keep the face that is turned away out of the tab order and the a11y tree.
    ['front', 'back'].forEach(function (face) {
      var showing = (face === 'back') === on;
      var node = document.querySelector('.card__face--' + face);
      node.setAttribute('aria-hidden', showing ? 'false' : 'true');
      Array.prototype.forEach.call(node.querySelectorAll('button, a'), function (b) {
        b.tabIndex = showing ? 0 : -1;
      });
    });

    stopSpeaking();
  }

  function render() {
    stopSpeaking();
    var total = deck.length;
    document.body.classList.toggle('empty', total === 0);

    if (!total) {
      el.status.textContent = 'No questions match those options — try widening the test, theme, topic or importance filter.';
      el.counter.textContent = '0 / 0';
      el.prev.disabled = el.next.disabled = true;
      return;
    }

    var card = deck[index];
    setFlipped(false);

    el.frontTheme.textContent = card.theme;
    el.frontTopic.textContent = card.topic;
    el.frontTopic.hidden = card.topic === card.theme;   // "Riding / Riding" reads as a mistake

    var tests = testsOf(card).sort(byTestOrder);
    el.frontTests.textContent = tests.join(' · ');
    el.frontTests.hidden = !tests.length;
    if (tests.length) {
      // The dot separator is decoration; read it out as words instead.
      var spoken = tests.length > 1
        ? tests.slice(0, -1).join(', ') + ' and ' + tests[tests.length - 1] + ' tests'
        : tests[0] + ' test';
      el.frontTests.setAttribute('aria-label', 'Applies to the ' + spoken);
    }

    el.frontImportant.hidden = card.important !== 'Yes';
    renderRich(card.question, el.frontText);

    el.backRef.textContent = card.theme + ' ' + card.number;
    renderRich(card.question, el.backPrompt);

    var hasAnswer = card.answer && card.answer.trim();
    renderRich(hasAnswer ? card.answer.trim() : EMPTY_ANSWER, el.backText);
    el.backText.classList.toggle('is-empty', !hasAnswer);

    el.counter.textContent = (index + 1) + ' / ' + total;
    el.prev.disabled = false;
    el.next.disabled = false;

    var important = deck.filter(function (c) { return c.important === 'Yes'; }).length;
    el.status.textContent = total + ' question' + (total === 1 ? '' : 's') +
      ' in this deck · ' + important + ' marked important';
  }

  function move(step) {
    if (!deck.length) return;
    index = (index + step + deck.length) % deck.length;
    render();
  }

  /* ---------- speech ---------- */

  var synth = window.speechSynthesis;
  var speakingBtn = null;
  var voices = [];
  var chosenVoice = null;

  // The Web Speech API has no gender field, so we go by the names the common
  // British and American voices actually ship under. Anything unrecognised is
  // simply left out of the male/female choice.
  var MALE = /^(daniel|arthur|oliver|george|ryan|thomas|alex|fred|aaron|gordon|guy|christopher|eric|brandon|james|rishi|alfie|elliot|ravi)\b/;
  var FEMALE = /^(kate|serena|martha|hazel|susan|samantha|victoria|karen|moira|tessa|fiona|catherine|sonia|libby|michelle|aria|jenny|natasha|allison|ava|joanna|zira|emma|amelie|nicky|shelley|maisie|olivia|clara)\b/;

  function genderOf(voice) {
    var n = (voice.name || '').toLowerCase();
    if (/\bfemale\b/.test(n)) return 'female';
    if (/\bmale\b/.test(n)) return 'male';
    // Strip a "Microsoft " / "Google " prefix before matching the given name.
    var bare = n.replace(/^(microsoft|google|apple)\s+/, '');
    if (FEMALE.test(bare)) return 'female';
    if (MALE.test(bare)) return 'male';
    return null;
  }

  function rank(voice) {                 // lower is better
    return (voice.lang === 'en-GB' ? 0 : /^en[-_]/i.test(voice.lang) ? 1 : 2);
  }

  function voicesFor(gender) {
    return voices.filter(function (v) { return genderOf(v) === gender; })
                 .sort(function (a, b) { return rank(a) - rank(b); });
  }

  function defaultVoice() {
    var sorted = voices.slice().sort(function (a, b) { return rank(a) - rank(b); });
    return sorted.filter(function (v) { return v.default; })[0] || sorted[0] || null;
  }

  function setUpVoices() {
    if (!synth) return;
    // Chrome hands over an empty list at first and fills it in later. It usually
    // fires voiceschanged when it does — but not always, so we also look again a
    // few times over the first few seconds rather than trusting the event alone.
    pollVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = loadVoices;

    Array.prototype.forEach.call(el.voiceField.querySelectorAll('.seg__btn'), function (btn) {
      btn.addEventListener('click', function () {
        var pick = voicesFor(btn.dataset.gender)[0];
        if (!pick) return;
        chosenVoice = pick;
        markVoiceButtons();
        speakSample();
      });
    });
  }

  var polls = 0;

  function pollVoices() {
    loadVoices();
    if (voices.length || polls++ > 12) return;      // ~3 seconds, then give up
    setTimeout(pollVoices, 250);
  }

  function loadVoices() {
    var all = synth.getVoices() || [];
    var english = all.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    voices = english.length ? english : all;
    // Most Pony Club members are girls, so start on a female voice where the
    // device has one; otherwise fall back to whatever the device defaults to.
    if (!chosenVoice) chosenVoice = voicesFor('female')[0] || defaultVoice();
    buildVoiceControl();
  }

  function buildVoiceControl() {
    var shown = 0;
    Array.prototype.forEach.call(el.voiceField.querySelectorAll('.seg__btn'), function (btn) {
      var has = voicesFor(btn.dataset.gender).length > 0;
      btn.hidden = !has;
      if (has) shown++;
    });
    // A single button is not a choice — hide the whole control in that case.
    el.voiceField.hidden = shown < 2;
    markVoiceButtons();
  }

  function markVoiceButtons() {
    var current = chosenVoice ? genderOf(chosenVoice) : null;
    Array.prototype.forEach.call(el.voiceField.querySelectorAll('.seg__btn'), function (btn) {
      var on = btn.dataset.gender === current;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
    });
  }

  function speakSample() {
    var card = deck[index];
    if (card) speak(plainText(card.question).split(/[;:\n]/)[0], null);
  }

  function stopSpeaking() {
    if (synth && synth.speaking) synth.cancel();
    if (speakingBtn) speakingBtn.classList.remove('is-speaking');
    speakingBtn = null;
  }

  function speak(text, btn) {
    if (!synth) {
      el.status.textContent = 'This browser does not support read-aloud.';
      return;
    }
    if (btn && speakingBtn === btn) { stopSpeaking(); return; }   // tapping again stops it
    stopSpeaking();

    var u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) u.voice = chosenVoice;
    u.lang = (chosenVoice && chosenVoice.lang) || 'en-GB';
    u.rate = 0.95;
    if (btn) {
      u.onend = u.onerror = function () {
        btn.classList.remove('is-speaking');
        if (speakingBtn === btn) speakingBtn = null;
      };
      speakingBtn = btn;
      btn.classList.add('is-speaking');
    }
    synth.speak(u);

    // A few browsers only populate the voice list once speech has started.
    if (!voices.length) setTimeout(loadVoices, 250);
  }

  function visibleText() {
    var card = deck[index];
    if (!card) return '';
    var question = plainText(card.question);
    if (!el.card.classList.contains('is-flipped')) return question;
    var answer = card.answer && card.answer.trim();
    return question + '. ' + (answer ? plainText(answer) : 'No answer has been recorded for this question yet.');
  }

  /* ---------- events ---------- */

  function bind() {
    el.card.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;          // following a link, not flipping
      setFlipped(!el.card.classList.contains('is-flipped'));
    });

    el.card.addEventListener('keydown', function (e) {
      if (e.target.closest('a')) return;          // Enter on a focused link follows it
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
        e.preventDefault();
        setFlipped(!el.card.classList.contains('is-flipped'));
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll('.speak'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();          // don't flip the card
        speak(visibleText(), btn);
      });
    });

    el.prev.addEventListener('click', function () { move(-1); });
    el.next.addEventListener('click', function () { move(1); });
    el.shuffle.addEventListener('click', buildDeck);
    el.reset.addEventListener('click', resetFilters);

    el.test.addEventListener('change', function () { populateTopics(); buildDeck(); });
    el.theme.addEventListener('change', function () { populateTopics(); buildDeck(); });
    el.topic.addEventListener('change', buildDeck);
    el.important.addEventListener('change', buildDeck);

    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|SELECT|TEXTAREA|A)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { move(1); }
      else if (e.key === 'ArrowLeft') { move(-1); }
      else if (e.key === 's' || e.key === 'S') {
        var face = el.card.classList.contains('is-flipped') ? 'back' : 'front';
        speak(visibleText(), document.querySelector('.speak[data-face="' + face + '"]'));
      } else if ((e.key === ' ' || e.key === 'Spacebar') && e.target !== el.card) {
        e.preventDefault();
        setFlipped(!el.card.classList.contains('is-flipped'));
      }
    });

    window.addEventListener('pagehide', stopSpeaking);
  }

  boot();
})();
