// Recorded scenario player, adapted from the DevCapsule console.
(function () {
  "use strict";

  const DATA_FILE = "presentation.json";
  const RATES = [0.5, 0.75, 1];
  const DEFAULT_RATE = 0.5;
  // During "Play all" the recording waits this long on each new step, so its title can be read.
  const HOLD_MILLISECONDS = 1500;
  // A step is over this close to its end: a frame of the recording lasts longer.
  const END_TOLERANCE_SECONDS = 0.02;
  // The recording and its description disagree when their lengths differ by more than this.
  const DURATION_TOLERANCE_SECONDS = 0.5;

  function el(tag, attributes, children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes || {})) {
      if (name === "text") node.textContent = value;
      else node.setAttribute(name, value);
    }
    for (const child of children || []) node.appendChild(child);
    return node;
  }

  // The texts of a presentation may mark `code`, **strong** and *emphasis*.
  // Nothing else is interpreted, and every piece becomes a text node.
  const MARK = /(``.+?``|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/;
  function inline(text) {
    return String(text).split(MARK).filter((piece) => piece !== "").map((piece) => {
      if (piece.length > 4 && piece.startsWith("``") && piece.endsWith("``")) return el("code", { text: piece.slice(2, -2).trim() });
      if (piece.length > 2 && piece.startsWith("`") && piece.endsWith("`")) return el("code", { text: piece.slice(1, -1) });
      if (piece.length > 4 && piece.startsWith("**") && piece.endsWith("**")) return el("strong", { text: piece.slice(2, -2) });
      if (piece.length > 2 && piece.startsWith("*") && piece.endsWith("*")) return el("em", { text: piece.slice(1, -1) });
      return document.createTextNode(piece);
    });
  }

  function fileUrl(directory, name) {
    return directory + name.split("/").map(encodeURIComponent).join("/");
  }

  function stepCount(count) {
    return count === 1 ? "1 step" : count + " steps";
  }

  function clock(seconds) {
    const whole = Math.max(0, Math.round(seconds));
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
  }

  // The step that is playing at a time of the recording: the last one that
  // has started. Steps are in order and do not overlap (problems checks it).
  function stepIndexAt(steps, time) {
    let index = 0;
    for (let candidate = 0; candidate < steps.length; candidate++) if (steps[candidate].start <= time) index = candidate;
    return index;
  }

  function captionIndexAt(step, time) {
    return step.captions.findIndex((caption) => caption.start <= time && time < caption.end);
  }

  // Build the deck for a checked document and wire it. Slide 0 is the
  // overview; slide n is step n. One <video> stays in place for every slide:
  // moving a playing video in the document would stop it.
  function present(container, directory, doc) {
    const steps = doc.steps;
    const duration = doc.video.duration;

    // What the page is doing. `playing` is null at rest, "step" while one step
    // plays to its end, "all" while the recording plays through. `holding` is
    // the timer of the pause on a new step during "all", or null.
    const state = { slide: 0, playing: null, paused: false, finished: false, rate: DEFAULT_RATE, holding: null, frame: null };

    const video = el("video", { preload: "metadata", playsinline: "", src: fileUrl(directory, doc.video.file) });
    video.muted = true;
    video.setAttribute("aria-label", doc.title);
    const still = el("img", { class: "still", alt: "" });
    // The whole resting screen is the button; `pill` is its visible label.
    const pill = el("span", { class: "pill" });
    const overlay = el("button", { type: "button", class: "overlay" }, [pill]);
    const screen = el("div", { class: "screen" }, [video, still, overlay]);
    const caption = el("p", { class: "caption", "aria-live": "polite" });
    const notice = el("p", { class: "notice" });
    notice.hidden = true;
    const primary = el("button", { type: "button", class: "primary" });
    const fill = el("span");
    const progress = el("div", { class: "progress" }, [fill]);
    const time = el("span", { class: "time" });
    const rate = el("select", { "aria-label": "Playback speed" }, RATES.map((value) => {
      const option = el("option", { value: String(value), text: value + "×" });
      option.selected = value === DEFAULT_RATE;
      return option;
    }));
    const layout = el("button", { type: "button", class: "quiet" });
    const transport = el("div", { class: "transport" }, [
      primary, progress, time, el("label", { class: "speed" }, [document.createTextNode("Speed "), rate]), layout,
    ]);
    const stage = el("section", { class: "stage" }, [el("div", { class: "player" }, [screen, caption, transport, notice])]);
    const text = el("section", { class: "slide" });
    const deck = el("div", { class: "deck" }, [text, stage]);

    const previous = el("button", { type: "button", class: "quiet", text: "← Previous" });
    const next = el("button", { type: "button", class: "quiet", text: "Next →" });
    const playAll = el("button", { type: "button", class: "quiet", text: "▶ Play all" });
    const chips = [el("button", { type: "button", class: "chip", text: "Overview" })].concat(
      steps.map((step, index) => el("button", { type: "button", class: "chip", text: String(index + 1), title: step.title })));
    const navigation = el("nav", { class: "deck-nav", "aria-label": "Slides" }, [
      previous, el("span", { class: "chips" }, chips), next, playAll,
    ]);
    // The captions of the slide's step, as the buttons under "Moments".
    let moments = [];
    let activeCaption;

    function scope() {
      return state.slide === 0 ? { start: 0, end: duration } : steps[state.slide - 1];
    }

    function heading(label) {
      return el("h2", { text: label });
    }

    function overviewSlide() {
      const overview = doc.overview;
      const nodes = [
        el("p", { class: "eyebrow", text: "Recorded scenario · " + stepCount(steps.length) + " · " + clock(duration) }),
        el("h1", {}, inline(doc.title)),
        el("p", { class: "summary" }, inline(overview.summary)),
      ];
      if (overview.intent) nodes.push(heading("Why this scenario"), el("p", {}, inline(overview.intent)));
      if (overview.illustrates && overview.illustrates.length) {
        nodes.push(heading("What it shows"), el("ul", {}, overview.illustrates.map((item) => el("li", {}, inline(item)))));
      }
      nodes.push(heading("The steps"), el("ol", { class: "outline" }, steps.map((step, index) => {
        const link = el("button", { type: "button", class: "link" }, inline(step.title));
        link.addEventListener("click", () => show(index + 1));
        return el("li", {}, [link]);
      })));
      if (overview.stack && overview.stack.length) {
        const rows = el("dl", { class: "stack" });
        for (const row of overview.stack) {
          rows.appendChild(el("dt", {}, inline(row.name)));
          rows.appendChild(el("dd", {}, inline(row.detail)));
        }
        nodes.push(el("details", {}, [el("summary", { text: "The stack" }), rows]));
      }
      return nodes;
    }

    function stepSlide(index) {
      const step = steps[index];
      moments = step.captions.map((item) => {
        const moment = el("button", { type: "button", class: "moment" }, [
          el("span", { class: "at", text: clock(item.start - step.start) }),
          el("span", {}, inline(item.text)),
        ]);
        moment.addEventListener("click", () => play("step", item.start));
        return moment;
      });
      return [
        el("p", { class: "eyebrow", text: "Step " + (index + 1) + " of " + steps.length }),
        el("h1", {}, inline(step.title)),
        heading("What the user does"), el("p", {}, inline(step.action)),
        heading("What you should see"), el("p", {}, inline(step.expected)),
        heading("Moments"), el("ol", { class: "moments" }, moments.map((moment) => el("li", {}, [moment]))),
      ];
    }

    function renderSlide() {
      moments = [];
      activeCaption = undefined;
      text.replaceChildren(...(state.slide === 0 ? overviewSlide() : stepSlide(state.slide - 1)));
      chips.forEach((chip, index) => {
        if (index === state.slide) chip.setAttribute("aria-current", "true"); else chip.removeAttribute("aria-current");
      });
      previous.disabled = state.slide === 0;
      next.disabled = state.slide === steps.length;
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#" + (state.slide === 0 ? "overview" : state.slide));
      }
    }

    // The caption, the lit moment, the bar and the clock for a time of the
    // recording; null is the slide at rest, before anything has played.
    function paint(now) {
      const range = scope();
      const index = now === null || state.slide === 0 ? -1 : captionIndexAt(range, now);
      if (now === null) {
        activeCaption = undefined;
        caption.replaceChildren(el("span", { class: "hint", text: state.slide === 0
          ? "Play all, or go through the steps one at a time. Captions appear here."
          : "Show this step to watch it happen. Captions appear here." }));
      } else if (activeCaption !== index) {
        activeCaption = index;
        caption.replaceChildren(...(index < 0 ? [] : inline(range.captions[index].text)));
      }
      moments.forEach((moment, position) => {
        if (position === index) moment.setAttribute("aria-current", "true"); else moment.removeAttribute("aria-current");
      });
      const elapsed = now === null ? 0 : Math.min(Math.max(now - range.start, 0), range.end - range.start);
      fill.style.width = (100 * elapsed / (range.end - range.start)) + "%";
      time.textContent = clock(elapsed) + " / " + clock(range.end - range.start);
    }

    function labels() {
      const idle = state.slide === 0 ? "▶ Play all" : state.finished ? "↺ Replay this step" : "▶ Show this step";
      primary.textContent = !state.playing ? idle : state.paused ? "▶ Resume" : "❚❚ Pause";
      pill.textContent = idle;
      playAll.textContent = state.slide === 0 ? "▶ Play all" : "▶ Play all from here";
    }

    function cancelFrame() {
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      state.frame = null;
    }

    function cancelHold() {
      if (state.holding !== null) clearTimeout(state.holding);
      state.holding = null;
    }

    // Follow the recording between its own timeupdate events, which are too
    // far apart to stop a step on its last frame.
    function follow() {
      cancelFrame();
      state.frame = requestAnimationFrame(() => {
        state.frame = null;
        sync();
        if (state.playing && !state.paused && state.holding === null) follow();
      });
    }

    function run() {
      const started = video.play();
      started.catch((error) => {
        if (error.name === "AbortError") return;
        halt();
        state.playing = null;
        labels();
        notice.textContent = "Playback could not start. Try again or open the recording below.";
        notice.hidden = false;
      });
      follow();
    }

    function halt() {
      cancelHold();
      cancelFrame();
      video.pause();
    }

    // The page's reaction to the recording's time: end the step, or during
    // "all" change the slide and wait on it, then repaint.
    function sync() {
      if (!state.playing) return;
      const now = video.currentTime;
      if (state.playing === "all") {
        const slide = stepIndexAt(steps, now) + 1;
        if (slide !== state.slide) {
          state.slide = slide;
          renderSlide();
          labels();
          cancelFrame();
          video.pause();
          state.holding = setTimeout(() => {
            state.holding = null;
            if (state.playing && !state.paused) run();
          }, HOLD_MILLISECONDS);
        }
      }
      const end = state.playing === "all" ? duration : scope().end;
      paint(now);
      if (now >= end - END_TOLERANCE_SECONDS || video.ended) {
        halt();
        state.playing = null;
        state.finished = true;
        labels();
      }
    }

    function play(mode, from) {
      halt();
      state.playing = mode;
      state.paused = false;
      state.finished = false;
      still.hidden = true;
      overlay.hidden = true;
      video.playbackRate = state.rate;
      video.currentTime = from;
      labels();
      paint(from);
      run();
    }

    // Go to a slide and rest on it: its screenshot, and the button that plays it.
    function show(slide) {
      halt();
      state.slide = Math.min(Math.max(slide, 0), steps.length);
      state.playing = null;
      state.paused = false;
      state.finished = false;
      renderSlide();
      still.setAttribute("src", fileUrl(directory, state.slide === 0 ? doc.video.poster : steps[state.slide - 1].screenshot));
      still.hidden = false;
      overlay.hidden = false;
      labels();
      paint(null);
    }

    function toggle() {
      if (!state.playing) {
        play(state.slide === 0 ? "all" : "step", scope().start);
        return;
      }
      state.paused = !state.paused;
      if (state.paused) halt(); else run();
      labels();
    }

    primary.addEventListener("click", toggle);
    overlay.addEventListener("click", toggle);
    video.addEventListener("click", toggle);
    video.addEventListener("timeupdate", sync);
    // A recording made again without its presentation.json is the likely way
    // for the two to disagree. A recording that does not state its length
    // (the browser reports infinity) cannot be compared.
    function compareLengths() {
      if (!Number.isFinite(video.duration) || Math.abs(video.duration - duration) <= DURATION_TOLERANCE_SECONDS) return;
      notice.textContent = "The recording lasts " + video.duration.toFixed(1) + " s and " + DATA_FILE + " describes "
        + duration.toFixed(1) + " s: the steps and captions may be out of place.";
      notice.hidden = false;
    }
    video.addEventListener("loadedmetadata", () => {
      if (video.videoWidth && video.videoHeight) stage.style.setProperty("--aspect", String(video.videoWidth / video.videoHeight));
      compareLengths();
    });
    video.addEventListener("durationchange", compareLengths);
    video.addEventListener("error", () => {
      notice.textContent = "The recording " + doc.video.file + " could not be loaded from this folder.";
      notice.hidden = false;
    });
    previous.addEventListener("click", () => show(state.slide - 1));
    next.addEventListener("click", () => show(state.slide + 1));
    playAll.addEventListener("click", () => play("all", scope().start));
    chips.forEach((chip, index) => chip.addEventListener("click", () => show(index)));
    rate.addEventListener("change", () => {
      state.rate = Number(rate.value);
      video.playbackRate = state.rate;
    });
    layout.textContent = "Larger video";
    layout.addEventListener("click", () => {
      const wide = deck.getAttribute("class") === "deck";
      deck.setAttribute("class", wide ? "deck wide" : "deck");
      layout.textContent = wide ? "Side by side" : "Larger video";
    });
    // The keys of a deck. A focused field keeps its own keys, and a focused
    // button keeps the space bar, which presses it.
    document.addEventListener("keydown", (event) => {
      if (event.target !== document.body && !container.contains(event.target)) return;
      const focused = event.target && event.target.tagName;
      if (event.altKey || event.ctrlKey || event.metaKey || ["SELECT", "INPUT", "TEXTAREA"].includes(focused)) return;
      if (["ArrowRight", "ArrowLeft", "PageDown", "PageUp", "Home"].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowRight" || event.key === "PageDown") show(state.slide + 1);
      else if (event.key === "ArrowLeft" || event.key === "PageUp") show(state.slide - 1);
      else if (event.key === "Home") show(0);
      else if (event.key === " " && focused !== "BUTTON") { event.preventDefault(); toggle(); }
    });

    container.replaceChildren(deck, navigation);
    const named = /^#(\d+)$/.exec(window.location.hash || "");
    show(named ? Number(named[1]) : 0);
  }

  const container = document.querySelector("[data-presentation-media]");
  const directory = container.dataset.presentationMedia;
  fetch(fileUrl(directory, DATA_FILE)).then(response => {
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }).then(doc => present(container, directory, doc)).catch(() => {
    container.prepend(el("p", { role: "status", text: "The interactive player could not load. The recording and steps are below." }));
  });
})();
