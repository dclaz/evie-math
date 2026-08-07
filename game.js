/* Evie's adding game — no libraries, no network, runs from file://
   Flow: tap to start -> problem appears and is spoken -> child types the sum
   -> groups slide together -> party -> next problem.

   A wrong answer never advances: the same problem stays up until she lands
   on it, so she always finishes the sum she is looking at. */

(function () {
  "use strict";

  // Each addend is 0-10, drawn flat at random, so sums run 0 through 20 and
  // 10 + 10 is fair game. No difficulty curve: every problem is equally likely.
  var MAX_ADDEND = 10;

  // Numeral faces, one drawn per problem, so the same digit turns up in more
  // than one shape. "rounded" is the default styling on #equation.
  var FACES = ["rounded", "mono", "hand"];

  var PRAISE = [
    "Yay!",
    "You did it!",
    "Amazing!",
    "Great job!",
    "Woohoo!",
    "Super star!",
    "Well done!"
  ];

  // Neutral, never a scolding — a wrong answer is just another go.
  var RETRY = [
    "Try again.",
    "Have another go.",
    "One more try."
  ];

  var elGame = document.getElementById("game");
  var elStart = document.getElementById("start");
  var elStartBtn = document.getElementById("start-btn");
  var elGroups = document.getElementById("groups");
  var elGroupA = document.getElementById("group-a");
  var elGroupB = document.getElementById("group-b");
  var elEquation = document.getElementById("equation");
  var elNumA = document.getElementById("num-a");
  var elNumB = document.getElementById("num-b");
  var elAnswer = document.getElementById("answer");
  var elAnswerText = document.getElementById("answer-text");
  var elFlash = document.getElementById("flash");
  var elStatScore = document.getElementById("stat-score");
  var elStatRate = document.getElementById("stat-rate");
  var canvas = document.getElementById("confetti");
  var ctx = canvas.getContext("2d");

  var current = null;       // { a, b, sum, emoji, face }
  var typed = "";           // digits entered so far
  var started = false;
  var celebrating = false;
  var missedThisProblem = false;
  var timers = [];

  var correctCount = 0;     // problems solved, however many tries it took
  var firstTryCount = 0;
  var problemsDone = 0;
  var sessionStart = null;
  var rateTimer = 0;

  /* ---------------- audio ---------------- */

  var audio = null;

  function initAudio() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { return; }
    try {
      audio = new Ctor();
    } catch (e) {
      audio = null;
    }
  }

  function tone(freq, startAt, dur, peak, type) {
    if (!audio) { return; }
    var t0 = audio.currentTime + startAt;
    var osc = audio.createOscillator();
    var gain = audio.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function resumeAudio() {
    if (audio && audio.state === "suspended" && audio.resume) {
      audio.resume().catch(function () { /* ignore */ });
    }
  }

  function soundChime() {
    var notes = [523.25, 659.25, 783.99, 1046.5];   // C E G C
    for (var i = 0; i < notes.length; i++) {
      tone(notes[i], i * 0.11, 0.55, 0.15, "triangle");
    }
    tone(1318.5, 0.5, 0.7, 0.10, "sine");
  }

  // Soft, friendly "boing" — never sounds like an error buzzer.
  function soundBounce() {
    if (!audio) { return; }
    var t0 = audio.currentTime;
    var osc = audio.createOscillator();
    var gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, t0);
    osc.frequency.exponentialRampToValueAtTime(190, t0 + 0.14);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  // Tiny tick as a digit lands, so typing feels responsive.
  function soundTick() {
    tone(880, 0, 0.05, 0.05, "sine");
  }

  /* ---------------- speech ----------------
     Lines are never cancelled: SpeechSynthesis queues them, so answering
     before "five plus three" has finished appends rather than clips. */

  function speak(text, rate, pitch) {
    if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) {
      return;
    }
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.rate = rate || 0.9;
      u.pitch = pitch || 1.3;
      u.volume = 1;
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is a bonus, never fatal */ }
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
  }

  function speechBusy() {
    if (!("speechSynthesis" in window)) { return false; }
    try {
      return window.speechSynthesis.speaking || window.speechSynthesis.pending;
    } catch (e) {
      return false;
    }
  }

  function speakProblem() {
    speak(current.a + " plus " + current.b, 0.85, 1.3);
  }

  /* ---------------- confetti ---------------- */

  var particles = [];
  var rafId = 0;
  var CONFETTI_COLORS = ["#ffb3d9", "#ffd9a0", "#bfe6ff", "#c7f5cf",
                         "#e2c9ff", "#fff3a8"];

  function sizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burstConfetti() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var origins = [
      { x: w * 0.5, y: h * 0.5 },
      { x: w * 0.14, y: h * 0.72 },
      { x: w * 0.86, y: h * 0.72 }
    ];
    particles = [];
    for (var o = 0; o < origins.length; o++) {
      var n = o === 0 ? 80 : 40;
      for (var i = 0; i < n; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 4 + Math.random() * 9;
        particles.push({
          x: origins[o].x,
          y: origins[o].y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 5,
          size: 6 + Math.random() * 9,
          color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
          spin: (Math.random() - 0.5) * 0.35,
          rot: Math.random() * Math.PI,
          life: 0,
          ttl: 80 + Math.random() * 30      // ~1.3-1.8s at 60fps
        });
      }
    }
    if (!rafId) { rafId = window.requestAnimationFrame(drawConfetti); }
  }

  function drawConfetti() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var alive = 0;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life > p.ttl) { continue; }
      alive++;
      p.life++;
      p.vy += 0.28;                 // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      var fade = 1 - Math.max(0, (p.life - p.ttl * 0.7) / (p.ttl * 0.3));
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (alive > 0) {
      rafId = window.requestAnimationFrame(drawConfetti);
    } else {
      rafId = 0;
      particles = [];
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  function clearConfetti() {
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    particles = [];
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  /* ---------------- timers ---------------- */

  function later(fn, ms) {
    var id = window.setTimeout(function () {
      timers.splice(timers.indexOf(id), 1);
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) { window.clearTimeout(timers[i]); }
    timers = [];
  }

  /* ---------------- stats ---------------- */

  function updateStats() {
    var pct = problemsDone ? Math.round((firstTryCount / problemsDone) * 100) : 0;
    // Accuracy is first-try accuracy: retries are how learning works, so they
    // don't count against her.
    elStatScore.textContent = "✅ " + correctCount + " · " + pct + "%";

    // Held at 0 for the first few seconds, when dividing by a sliver of a
    // minute would otherwise report an absurd rate.
    var elapsedMs = sessionStart ? Date.now() - sessionStart : 0;
    var cpm = (correctCount > 0 && elapsedMs > 3000)
      ? Math.round(correctCount / (elapsedMs / 60000))
      : 0;
    elStatRate.textContent = cpm + " correct/min";
  }

  /* ---------------- problem flow ---------------- */

  function randomInt(n) {
    return (Math.random() * n) | 0;
  }

  // Draw again whenever the draw matches the problem just gone, so nothing —
  // the pair, the emoji, or the face — ever repeats back to back.
  function pickProblem() {
    var a, b;
    do {
      a = randomInt(MAX_ADDEND + 1);
      b = randomInt(MAX_ADDEND + 1);
    } while (current && a === current.a && b === current.b);

    var emoji;
    do {
      emoji = EMOJIS[randomInt(EMOJIS.length)];
    } while (current && emoji === current.emoji);

    var face;
    do {
      face = FACES[randomInt(FACES.length)];
    } while (current && face === current.face);

    return { a: a, b: b, sum: a + b, emoji: emoji, face: face };
  }

  function fillGroup(el, count, emoji) {
    el.textContent = "";
    el.classList.toggle("is-empty", count === 0);
    for (var i = 0; i < count; i++) {
      var span = document.createElement("span");
      span.className = "pip";
      span.textContent = emoji;
      // stagger, so the group counts itself in as it appears
      span.style.animationDelay = (i * 0.05) + "s";
      el.appendChild(span);
    }
  }

  function loadProblem() {
    celebrating = false;
    missedThisProblem = false;
    current = pickProblem();

    elEquation.setAttribute("data-face", current.face);
    elGroups.classList.remove("combine");
    elAnswer.classList.remove("correct", "cheer");
    elNumA.classList.remove("cheer");
    elNumB.classList.remove("cheer");

    fillGroup(elGroupA, current.a, current.emoji);
    fillGroup(elGroupB, current.b, current.emoji);

    elNumA.textContent = current.a;
    elNumB.textContent = current.b;
    setTyped("");

    speakProblem();
  }

  function setTyped(value) {
    typed = value;
    elAnswerText.textContent = value;
    elAnswer.classList.toggle("is-empty", value === "");
  }

  function submit() {
    if (!typed) { return; }
    if (parseInt(typed, 10) === current.sum) {
      onCorrect();
    } else {
      onWrong();
    }
  }

  function onCorrect() {
    celebrating = true;
    correctCount++;
    problemsDone++;
    if (!missedThisProblem) { firstTryCount++; }
    updateStats();

    elAnswer.classList.add("correct");
    // Slide the two groups into one combined row first: that is the lesson.
    elGroups.classList.add("combine");

    later(function () {
      burstConfetti();
      elFlash.classList.add("sweep");
      elNumA.classList.add("cheer");
      elNumB.classList.add("cheer");
      elAnswer.classList.add("cheer");
      soundChime();
      speak(String(current.sum), 0.85, 1.35);
      speak(PRAISE[(Math.random() * PRAISE.length) | 0], 0.95, 1.5);
    }, 520);

    later(function () {
      clearConfetti();
      elFlash.classList.remove("sweep");
      loadProblem();
    }, 1900);
  }

  function onWrong() {
    missedThisProblem = true;

    elEquation.classList.remove("shake");
    void elEquation.offsetWidth;             // restart the animation
    elEquation.classList.add("shake");
    soundBounce();
    setTyped("");

    // Only prompt when the voice is actually free. Lines are never cancelled,
    // so without this a child repeating a wrong answer stacks two utterances
    // per attempt and the game keeps talking long after she has stopped. The
    // boing and the shake still answer every attempt instantly.
    if (!speechBusy()) {
      speak(RETRY[(Math.random() * RETRY.length) | 0], 0.95, 1.35);
      speakProblem();
    }
  }

  /* ---------------- input ---------------- */

  function handleKey(key) {
    if (!started || celebrating || !current) { return; }
    resumeAudio();

    if (key >= "0" && key <= "9") {
      if (typed.length >= 2) { return; }     // sums never exceed two digits
      setTyped(typed + key);
      soundTick();
    } else if (key === "Backspace" || key === "Delete") {
      if (typed) { setTyped(typed.slice(0, -1)); }
    } else if (key === "Enter") {
      submit();
    }
    // Every other key is ignored outright — no sound, no flicker.
  }

  /* ---------------- start ---------------- */

  function start() {
    if (started) { return; }
    started = true;
    sessionStart = Date.now();
    // The rate falls as time passes, not just as answers land, so it needs a
    // tick of its own or it would sit stale between problems.
    rateTimer = window.setInterval(updateStats, 1000);
    initAudio();
    resumeAudio();
    stopSpeech();
    speak("Let's do some adding!", 0.9, 1.4);
    elStart.classList.add("hidden");
    elGame.classList.remove("hidden");
    later(loadProblem, 700);
  }

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    if (!started) {
      if (e.key === " " || e.key === "Enter") { start(); }
      return;
    }
    var k = e.key;
    if ((k.length === 1 && k >= "0" && k <= "9") ||
        k === "Backspace" || k === "Delete" || k === "Enter") {
      e.preventDefault();
      handleKey(k);
    }
  });

  elStartBtn.addEventListener("click", start);
  window.addEventListener("resize", sizeCanvas);
  window.addEventListener("beforeunload", function () {
    clearTimers();
    if (rateTimer) { window.clearInterval(rateTimer); rateTimer = 0; }
    stopSpeech();
  });

  sizeCanvas();
  updateStats();

  // Exposed only so the page can be driven by an automated smoke test.
  window.__game = {
    press: handleKey,
    start: start,
    state: function () {
      return {
        started: started,
        celebrating: celebrating,
        a: current ? current.a : null,
        b: current ? current.b : null,
        sum: current ? current.sum : null,
        emoji: current ? current.emoji : null,
        face: current ? current.face : null,
        typed: typed,
        pipsA: elGroupA.childElementCount,
        pipsB: elGroupB.childElementCount,
        emptyA: elGroupA.classList.contains("is-empty"),
        emptyB: elGroupB.classList.contains("is-empty"),
        combining: elGroups.classList.contains("combine"),
        renderedFace: elEquation.getAttribute("data-face"),
        correctCount: correctCount,
        firstTryCount: firstTryCount,
        problemsDone: problemsDone,
        stats: elStatScore.textContent,
        rate: elStatRate.textContent,
        particles: particles.length
      };
    }
  };
}());
