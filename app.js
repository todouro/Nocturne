(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const whiteKeysRoot = $("#white-keys");
  const blackKeysRoot = $("#black-keys");
  const keyboardRoot = $("#keyboard");
  const audioButton = $("#audio-button");
  const audioButtonText = $(".audio-button__text");
  const octaveValue = $("#octave-value");
  const octaveDown = $("#octave-down");
  const octaveUp = $("#octave-up");
  const volumeSlider = $("#volume-slider");
  const volumeValue = $("#volume-value");
  const sustainButton = $("#sustain-button");
  const sustainState = $("#sustain-state");
  const settingsButton = $("#settings-button");
  const settingsPanel = $("#settings-panel");
  const settingsClose = $("#settings-close");
  const roomSlider = $("#room-slider");
  const roomValue = $("#room-value");
  const rangeLabel = $("#range-label");
  const noteReadout = $("#note-readout");
  const sceneFrequency = $("#scene-frequency");
  const sceneEmpty = $("#scene-empty");
  const footerStatus = $("#footer-status");
  const instrumentLiveDot = $(".instrument__live-dot");
  const canvas = $("#resonance-canvas");
  const canvasContext = canvas.getContext("2d", { alpha: true });

  const STORAGE_KEY = "nocturne.preferences.v1";
  const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const WHITE_INDICES = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
  const BLACK_INDICES = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
  const KEY_BINDINGS = [
    { code: "KeyZ", label: "Z", index: 0 }, { code: "KeyS", label: "S", index: 1 },
    { code: "KeyX", label: "X", index: 2 }, { code: "KeyD", label: "D", index: 3 },
    { code: "KeyC", label: "C", index: 4 }, { code: "KeyV", label: "V", index: 5 },
    { code: "KeyG", label: "G", index: 6 }, { code: "KeyB", label: "B", index: 7 },
    { code: "KeyH", label: "H", index: 8 }, { code: "KeyN", label: "N", index: 9 },
    { code: "KeyJ", label: "J", index: 10 }, { code: "KeyM", label: "M", index: 11 },
    { code: "KeyQ", label: "Q", index: 12 }, { code: "Digit2", label: "2", index: 13 },
    { code: "KeyW", label: "W", index: 14 }, { code: "Digit3", label: "3", index: 15 },
    { code: "KeyE", label: "E", index: 16 }, { code: "KeyR", label: "R", index: 17 },
    { code: "Digit5", label: "5", index: 18 }, { code: "KeyT", label: "T", index: 19 },
    { code: "Digit6", label: "6", index: 20 }, { code: "KeyY", label: "Y", index: 21 },
    { code: "Digit7", label: "7", index: 22 }, { code: "KeyU", label: "U", index: 23 }
  ];
  const bindingByCode = new Map(KEY_BINDINGS.map((entry) => [entry.code, entry]));
  const bindingByIndex = new Map(KEY_BINDINGS.map((entry) => [entry.index, entry]));

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  let octave = 3;
  let volume = 68;
  let roomAmount = 18;
  let sustain = false;
  let muted = false;
  let audioContext = null;
  let masterGain = null;
  let compressor = null;
  let delayNode = null;
  let feedbackGain = null;
  let wetGain = null;
  let noiseBuffer = null;
  let audioReady = false;
  let lastNote = null;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
  let lastFrameTime = 0;
  let firstFrame = true;

  const heldInputs = new Map();
  const activeMidiCounts = new Map();
  const keyElements = new Map();
  const voices = new Set();
  const waves = [];
  const particles = [];
  const activeVisualNotes = new Map();

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Number.isFinite(saved.octave)) octave = clamp(Math.round(saved.octave), 1, 6);
      if (Number.isFinite(saved.volume)) volume = clamp(Math.round(saved.volume), 0, 100);
      if (Number.isFinite(saved.roomAmount)) roomAmount = clamp(Math.round(saved.roomAmount), 0, 45);
    } catch (_) {
      // Storage can be disabled; sensible defaults still work.
    }
    octaveValue.textContent = String(octave).padStart(2, "0");
    volumeSlider.value = String(volume);
    volumeValue.textContent = String(volume);
    roomSlider.value = String(roomAmount);
    roomValue.textContent = String(roomAmount) + "%";
    octaveDown.disabled = octave <= 1;
    octaveUp.disabled = octave >= 6;
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        octave: octave,
        volume: volume,
        roomAmount: roomAmount
      }));
    } catch (_) {
      // Preferences are a convenience, not a requirement for playing.
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function baseMidi() {
    return (octave + 1) * 12;
  }

  function midiForIndex(index) {
    return baseMidi() + index;
  }

  function noteName(midi) {
    const pitchClass = NOTE_NAMES[((midi % 12) + 12) % 12];
    const noteOctave = Math.floor(midi / 12) - 1;
    return pitchClass + noteOctave;
  }

  function frequencyForMidi(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function formatFrequency(hz) {
    if (hz >= 1000) return (hz / 1000).toFixed(2) + " kHz";
    return hz.toFixed(hz >= 100 ? 1 : 2) + " Hz";
  }

  function createKey(index, isBlack) {
    const key = document.createElement("button");
    const binding = bindingByIndex.get(index);
    const note = document.createElement("span");
    const shortcut = document.createElement("span");
    key.type = "button";
    key.className = "piano-key " + (isBlack ? "piano-key--black" : "piano-key--white");
    key.dataset.index = String(index);
    key.dataset.black = isBlack ? "true" : "false";
    key.setAttribute("aria-label", "Piano note " + noteName(midiForIndex(index)) + ", computer key " + binding.label);
    key.title = noteName(midiForIndex(index)) + " · " + binding.label;
    key.tabIndex = 0;

    note.className = "piano-key__note";
    note.setAttribute("aria-hidden", "true");
    shortcut.className = "piano-key__shortcut";
    shortcut.textContent = binding.label;
    shortcut.setAttribute("aria-hidden", "true");

    // Keep note names discreet on the white keys; black keys show their pitch as well.
    if (isBlack || index === 0 || index === 12) note.textContent = noteName(midiForIndex(index));
    key.append(note, shortcut);

    key.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      try { key.setPointerCapture(event.pointerId); } catch (_) {}
      startNote(midiForIndex(index), "pointer:" + event.pointerId);
    });
    key.addEventListener("pointerup", (event) => finishInput("pointer:" + event.pointerId));
    key.addEventListener("pointercancel", (event) => finishInput("pointer:" + event.pointerId, true));
    key.addEventListener("lostpointercapture", (event) => finishInput("pointer:" + event.pointerId));
    key.addEventListener("keydown", (event) => {
      if ((event.code === "Space" || event.code === "Enter") && !event.repeat) {
        event.preventDefault();
        startNote(midiForIndex(index), "access:" + index);
      }
    });
    key.addEventListener("keyup", (event) => {
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        finishInput("access:" + index);
      }
    });

    keyElements.set(index, key);
    return key;
  }

  function renderKeyboard() {
    whiteKeysRoot.replaceChildren();
    blackKeysRoot.replaceChildren();
    keyElements.clear();

    WHITE_INDICES.forEach((index) => whiteKeysRoot.appendChild(createKey(index, false)));
    BLACK_INDICES.forEach((index) => {
      const key = createKey(index, true);
      const whiteKeysBefore = WHITE_INDICES.filter((whiteIndex) => whiteIndex < index).length;
      key.style.left = ((whiteKeysBefore / WHITE_INDICES.length) * 100) + "%";
      key.style.transform = "translateX(-50%)";
      blackKeysRoot.appendChild(key);
    });
    updateKeyboardLabels();
  }

  function updateKeyboardLabels() {
    for (let index = 0; index < 24; index += 1) {
      const key = keyElements.get(index);
      if (!key) continue;
      const midi = midiForIndex(index);
      const name = noteName(midi);
      const binding = bindingByIndex.get(index);
      const label = key.querySelector(".piano-key__note");
      if (label) label.textContent = (key.dataset.black === "true" || index === 0 || index === 12) ? name : "";
      key.setAttribute("aria-label", "Piano note " + name + ", computer key " + binding.label);
      key.title = name + " · " + binding.label;
      key.classList.toggle("is-active", (activeMidiCounts.get(midi) || 0) > 0);
    }
    const first = noteName(baseMidi());
    const last = noteName(baseMidi() + 23);
    rangeLabel.textContent = first + " — " + last;
    keyboardRoot.setAttribute("aria-label", "Playable piano keys, " + first + " through " + last);
  }

  function updateKeyState(midi, isDown) {
    const count = activeMidiCounts.get(midi) || 0;
    if (isDown) activeMidiCounts.set(midi, count + 1);
    else if (count <= 1) activeMidiCounts.delete(midi);
    else activeMidiCounts.set(midi, count - 1);

    const index = midi - baseMidi();
    const key = keyElements.get(index);
    if (key) key.classList.toggle("is-active", (activeMidiCounts.get(midi) || 0) > 0);

    if (isDown) activeVisualNotes.set(midi, performance.now());
    else if (!(activeMidiCounts.get(midi) > 0)) activeVisualNotes.delete(midi);
    updateLiveReadout();
  }

  function updateLiveReadout() {
    const count = activeVisualNotes.size;
    instrumentLiveDot.classList.toggle("is-ready", audioReady);
    if (count > 0) {
      noteReadout.textContent = count > 1 ? count + " NOTES IN THE AIR" : noteName(Array.from(activeVisualNotes.keys())[0]) + " · " + formatFrequency(frequencyForMidi(Array.from(activeVisualNotes.keys())[0]));
      sceneFrequency.textContent = count > 1 ? "A SMALL CHORD" : formatFrequency(frequencyForMidi(Array.from(activeVisualNotes.keys())[0])).toUpperCase();
    } else if (lastNote !== null) {
      noteReadout.textContent = noteName(lastNote) + " · " + formatFrequency(frequencyForMidi(lastNote));
      sceneFrequency.textContent = "STILL RESONATING";
    } else {
      noteReadout.textContent = audioReady ? "READY WHEN YOU ARE" : "WAITING FOR A NOTE";
      sceneFrequency.textContent = "LISTEN IN";
    }
  }

  function updateAudioInterface() {
    audioButton.classList.toggle("is-ready", audioReady && !muted);
    audioButton.classList.toggle("is-muted", muted);
    audioButton.setAttribute("aria-pressed", audioReady && !muted ? "true" : "false");
    if (!audioReady) {
      audioButtonText.textContent = "WAKE THE PIANO";
      audioButton.setAttribute("aria-label", "Enable piano audio");
      footerStatus.textContent = "A QUIET PLACE TO BEGIN";
    } else if (muted) {
      audioButtonText.textContent = "SOUND MUTED";
      audioButton.setAttribute("aria-label", "Unmute piano audio");
      footerStatus.textContent = "SOUND IS RESTING";
    } else {
      audioButtonText.textContent = "SOUND ON";
      audioButton.setAttribute("aria-label", "Mute piano audio");
      footerStatus.textContent = "THE ROOM IS LISTENING";
    }
    instrumentLiveDot.classList.toggle("is-ready", audioReady && !muted);
  }

  function setAudioStatusReady() {
    audioReady = true;
    updateAudioInterface();
    updateLiveReadout();
  }

  function ensureAudio() {
    if (audioContext) {
      if (audioContext.state === "suspended") {
        audioContext.resume().then(setAudioStatusReady).catch(() => {
          noteReadout.textContent = "TAP TO ENABLE SOUND";
        });
      }
      return audioContext;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      noteReadout.textContent = "AUDIO IS NOT SUPPORTED HERE";
      footerStatus.textContent = "TRY A RECENT BROWSER";
      audioButtonText.textContent = "AUDIO UNAVAILABLE";
      audioButton.disabled = true;
      return null;
    }

    try {
      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      compressor = audioContext.createDynamicsCompressor();
      delayNode = audioContext.createDelay(1.0);
      feedbackGain = audioContext.createGain();
      wetGain = audioContext.createGain();

      masterGain.gain.value = (muted ? 0 : volume / 100) * 0.78;
      compressor.threshold.value = -19;
      compressor.knee.value = 17;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.24;
      delayNode.delayTime.value = 0.235;
      feedbackGain.gain.value = 0.13;
      wetGain.gain.value = roomAmount / 100 * 0.42;

      masterGain.connect(compressor);
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode);
      delayNode.connect(wetGain);
      wetGain.connect(compressor);
      compressor.connect(audioContext.destination);

      const bufferLength = Math.max(1, Math.floor(audioContext.sampleRate * 0.075));
      noiseBuffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLength; i += 1) noiseData[i] = (Math.random() * 2 - 1) * (1 - i / bufferLength);

      if (audioContext.state === "running") setAudioStatusReady();
      else if (audioContext.state === "suspended") {
        audioContext.resume().then(setAudioStatusReady).catch(() => {
          noteReadout.textContent = "TAP TO ENABLE SOUND";
        });
      }
      audioContext.addEventListener("statechange", () => {
        if (audioContext && audioContext.state === "running") setAudioStatusReady();
      });
      return audioContext;
    } catch (_) {
      noteReadout.textContent = "COULD NOT START AUDIO";
      footerStatus.textContent = "CHECK YOUR BROWSER AUDIO SETTINGS";
      return null;
    }
  }

  function createVoice(midi) {
    const context = ensureAudio();
    if (!context || !masterGain) return null;

    const now = context.currentTime;
    const fundamental = frequencyForMidi(midi);
    const mix = context.createGain();
    mix.gain.setValueAtTime(0.0001, now);
    mix.gain.exponentialRampToValueAtTime(1, now + 0.014);
    mix.connect(masterGain);
    mix.connect(delayNode);

    // A small group of tuned partials makes a warmer, bell-like string tone than a raw oscillator.
    const partials = [
      { ratio: 1, level: 0.2, detune: 0 },
      { ratio: 2.0015, level: 0.078, detune: 0 },
      { ratio: 3.006, level: 0.035, detune: -1.5 },
      { ratio: 4.012, level: 0.018, detune: 1.2 },
      { ratio: 5.02, level: 0.009, detune: 0.5 }
    ];
    const oscillators = [];

    partials.forEach((partial, index) => {
      const oscillator = context.createOscillator();
      const partialGain = context.createGain();
      const amp = partial.level * (index === 0 && midi < 54 ? 1.12 : 1);
      oscillator.type = index > 2 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(fundamental * partial.ratio, now);
      oscillator.detune.setValueAtTime(partial.detune, now);
      partialGain.gain.setValueAtTime(0.0001, now);
      partialGain.gain.exponentialRampToValueAtTime(amp, now + 0.012);
      partialGain.gain.exponentialRampToValueAtTime(Math.max(0.00011, amp * 0.22), now + 1.1);
      partialGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp * 0.027), now + 5.2);
      partialGain.gain.exponentialRampToValueAtTime(0.0001, now + 10.5 + index * 0.15);
      oscillator.connect(partialGain);
      partialGain.connect(mix);
      oscillator.start(now);
      oscillators.push({ oscillator: oscillator, gain: partialGain });
    });

    // A very short, filtered hammer transient gives each note a soft physical beginning.
    if (noiseBuffer) {
      const noise = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const transientGain = context.createGain();
      noise.buffer = noiseBuffer;
      filter.type = "bandpass";
      filter.frequency.value = clamp(fundamental * 7, 850, 3600);
      filter.Q.value = 0.72;
      transientGain.gain.setValueAtTime(0.0001, now);
      transientGain.gain.exponentialRampToValueAtTime(0.035, now + 0.003);
      transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      noise.connect(filter);
      filter.connect(transientGain);
      transientGain.connect(mix);
      noise.onended = () => {
        try { noise.disconnect(); filter.disconnect(); transientGain.disconnect(); } catch (_) {}
      };
      noise.start(now);
      noise.stop(now + 0.052);
    }

    const voice = { midi: midi, mix: mix, oscillators: oscillators, down: true, released: false };
    voices.add(voice);
    oscillators.forEach((partial) => {
      partial.oscillator.onended = () => {
        try { partial.oscillator.disconnect(); partial.gain.disconnect(); } catch (_) {}
        if (voice.released) {
          voice.remaining = (voice.remaining || oscillators.length) - 1;
          if (voice.remaining <= 0) cleanupVoice(voice);
        }
      };
    });
    return voice;
  }

  function cleanupVoice(voice) {
    if (!voices.has(voice)) return;
    voices.delete(voice);
    try { voice.mix.disconnect(); } catch (_) {}
  }

  function releaseVoice(voice, quickly) {
    if (!voice || voice.released) return;
    voice.released = true;
    const context = audioContext;
    if (!context) return;
    const now = context.currentTime;
    const duration = quickly ? 0.035 : 0.12;
    try {
      voice.mix.gain.cancelScheduledValues(now);
      if (typeof voice.mix.gain.cancelAndHoldAtTime === "function") voice.mix.gain.cancelAndHoldAtTime(now);
      voice.mix.gain.setTargetAtTime(0.0001, now, duration);
    } catch (_) {
      try {
        voice.mix.gain.setValueAtTime(0.0001, now);
      } catch (_) {}
    }
    voice.remaining = voice.oscillators.length;
    voice.oscillators.forEach((partial) => {
      try { partial.oscillator.stop(now + (quickly ? 0.12 : 0.58)); } catch (_) {}
    });
  }

  function startNote(midi, source) {
    if (heldInputs.has(source)) return;
    ensureAudio();
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime((muted ? 0 : volume / 100) * 0.78, audioContext.currentTime, 0.025);
    }

    const voice = createVoice(midi);
    heldInputs.set(source, { midi: midi, voice: voice });
    updateKeyState(midi, true);
    lastNote = midi;
    noteReadout.textContent = noteName(midi) + " · " + formatFrequency(frequencyForMidi(midi));
    sceneFrequency.textContent = formatFrequency(frequencyForMidi(midi)).toUpperCase();
    sceneEmpty.classList.add("is-hidden");
    updateAudioInterface();
    triggerResonance(midi);
  }

  function finishInput(source, force) {
    const held = heldInputs.get(source);
    if (!held) return;
    heldInputs.delete(source);
    updateKeyState(held.midi, false);
    if (held.voice) {
      held.voice.down = false;
      if (!sustain || force) releaseVoice(held.voice, Boolean(force));
    }
    if (force && activeMidiCounts.size === 0) activeVisualNotes.clear();
    updateLiveReadout();
  }

  function releaseAll(quickly) {
    Array.from(heldInputs.keys()).forEach((source) => finishInput(source, true));
    if (quickly) {
      voices.forEach((voice) => releaseVoice(voice, true));
      activeVisualNotes.clear();
      activeMidiCounts.clear();
      keyElements.forEach((key) => key.classList.remove("is-active"));
      updateLiveReadout();
    }
  }

  function setOctave(nextOctave) {
    const next = clamp(nextOctave, 1, 6);
    if (next === octave) return;
    releaseAll(true);
    octave = next;
    octaveValue.textContent = String(octave).padStart(2, "0");
    octaveDown.disabled = octave <= 1;
    octaveUp.disabled = octave >= 6;
    updateKeyboardLabels();
    savePreferences();
    octaveValue.animate && !reducedMotion && octaveValue.animate(
      [{ opacity: 0.35, transform: "translateY(2px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 220, easing: "cubic-bezier(.2,.7,.25,1)" }
    );
  }

  function setVolume(value) {
    volume = clamp(Number(value) || 0, 0, 100);
    volumeSlider.value = String(volume);
    volumeValue.textContent = String(volume);
    if (volume > 0) muted = false;
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime((muted ? 0 : volume / 100) * 0.78, audioContext.currentTime, 0.025);
    }
    updateAudioInterface();
    savePreferences();
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    if (muted) releaseAll(true);
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime((muted ? 0 : volume / 100) * 0.78, audioContext.currentTime, 0.025);
    }
    updateAudioInterface();
  }

  function setSustain(enabled) {
    sustain = Boolean(enabled);
    sustainButton.setAttribute("aria-pressed", sustain ? "true" : "false");
    sustainState.textContent = sustain ? "ON" : "OFF";
    if (!sustain) voices.forEach((voice) => {
      if (!voice.down) releaseVoice(voice, false);
    });
  }

  function setRoomAmount(value) {
    roomAmount = clamp(Number(value) || 0, 0, 45);
    roomSlider.value = String(roomAmount);
    roomValue.textContent = String(roomAmount) + "%";
    if (wetGain && audioContext) {
      wetGain.gain.setTargetAtTime(roomAmount / 100 * 0.42, audioContext.currentTime, 0.04);
    }
    savePreferences();
  }

  function isEditableTarget(target) {
    return Boolean(target && (
      target.isContentEditable ||
      target.closest("input, textarea, select, [contenteditable='true']")
    ));
  }

  function setUpKeyboardShortcuts() {
    window.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;
      if (event.code === "BracketLeft") {
        if (!event.repeat) setOctave(octave - 1);
        event.preventDefault();
        return;
      }
      if (event.code === "BracketRight") {
        if (!event.repeat) setOctave(octave + 1);
        event.preventDefault();
        return;
      }
      const binding = bindingByCode.get(event.code);
      if (!binding || event.repeat) return;
      event.preventDefault();
      startNote(midiForIndex(binding.index), "keyboard:" + event.code);
    });

    window.addEventListener("keyup", (event) => {
      const source = "keyboard:" + event.code;
      if (heldInputs.has(source)) {
        event.preventDefault();
        finishInput(source);
      }
    });

    window.addEventListener("blur", () => releaseAll(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") releaseAll(true);
    });
    window.addEventListener("pagehide", () => releaseAll(true));
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = Math.max(1, rect.width);
    canvasHeight = Math.max(1, rect.height);
    canvas.width = Math.round(canvasWidth * pixelRatio);
    canvas.height = Math.round(canvasHeight * pixelRatio);
    canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (waves.length || particles.length || activeVisualNotes.size) requestDraw();
  }

  function pitchPosition(midi) {
    const index = clamp(midi - baseMidi(), 0, 23);
    return canvasWidth * ((index + 0.5) / 24);
  }

  function triggerResonance(midi) {
    const now = performance.now();
    const activeCount = Math.max(1, activeMidiCounts.size);
    const x = pitchPosition(midi);
    const y = canvasHeight * 0.58;
    const hue = 240 + ((midi % 12) / 12) * 31;
    const strength = Math.min(2.2, 1 + (activeCount - 1) * 0.36);

    waves.push({ x: x, y: y, radius: 2, strength: strength, hue: hue, born: now, lifetime: reducedMotion ? 580 : 1420 });
    if (activeCount > 1 && !reducedMotion) {
      waves.push({ x: x, y: y, radius: 1, strength: strength * 0.72, hue: hue + 8, born: now + 105, lifetime: 1600 });
    }

    const count = reducedMotion ? 3 : Math.min(19, 8 + activeCount * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i / count) + Math.random() * 0.5;
      const speed = (reducedMotion ? 0.13 : 0.25) + Math.random() * (reducedMotion ? 0.12 : 0.6);
      particles.push({
        x: x + (Math.random() - 0.5) * 7,
        y: y + (Math.random() - 0.5) * 5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.13,
        size: 0.55 + Math.random() * 1.2,
        hue: hue + Math.random() * 12,
        born: now,
        lifetime: (reducedMotion ? 450 : 720) + Math.random() * (reducedMotion ? 100 : 620)
      });
    }
    requestDraw();
  }

  function drawResonance(time) {
    animationFrame = 0;
    if (!canvasContext || !canvasWidth || !canvasHeight) return;

    const delta = lastFrameTime ? Math.min(40, time - lastFrameTime) : 16;
    lastFrameTime = time;
    const ctx = canvasContext;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const originY = canvasHeight * 0.58;
    const now = time;

    // A faint baseline appears only while the instrument is being played or still ringing.
    const isActive = activeVisualNotes.size > 0;
    if (isActive) {
      const notes = Array.from(activeVisualNotes.keys());
      const phase = time * (reducedMotion ? 0.00035 : 0.00115);
      for (let strand = 0; strand < (notes.length > 2 ? 3 : 2); strand += 1) {
        ctx.beginPath();
        for (let px = 0; px <= canvasWidth; px += 4) {
          let displacement = 0;
          notes.forEach((midi) => {
            const pitch = midi % 12;
            const amplitude = (reducedMotion ? 2.5 : 5.5) / Math.sqrt(notes.length);
            displacement += Math.sin(px * (0.012 + pitch * 0.0002) + phase + pitch * 0.52 + strand * 0.65) * amplitude;
          });
          const yy = originY + displacement + strand * 2.6;
          if (px === 0) ctx.moveTo(px, yy);
          else ctx.lineTo(px, yy);
        }
        ctx.strokeStyle = strand === 0 ? "rgba(180, 169, 220, .34)" : "rgba(118, 139, 174, .17)";
        ctx.lineWidth = strand === 0 ? 1 : 0.65;
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(194, 182, 228, .55)";
      notes.forEach((midi) => {
        ctx.beginPath();
        ctx.arc(pitchPosition(midi), originY, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    for (let i = waves.length - 1; i >= 0; i -= 1) {
      const wave = waves[i];
      const age = now - wave.born;
      const progress = age / wave.lifetime;
      if (progress >= 1) {
        waves.splice(i, 1);
        continue;
      }
      const eased = 1 - Math.pow(1 - progress, 2);
      const radius = wave.radius + eased * Math.min(canvasHeight * 0.77, 105);
      const alpha = (1 - progress) * (reducedMotion ? 0.23 : 0.34) * wave.strength;
      ctx.beginPath();
      ctx.ellipse(wave.x, wave.y, radius, radius * 0.27, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "hsla(" + wave.hue + ", 31%, 78%, " + alpha + ")";
      ctx.lineWidth = reducedMotion ? 0.6 : 0.85;
      ctx.stroke();

      if (!reducedMotion && progress < 0.68) {
        ctx.beginPath();
        ctx.moveTo(wave.x - radius * 0.58, wave.y);
        ctx.lineTo(wave.x + radius * 0.58, wave.y);
        ctx.strokeStyle = "hsla(" + wave.hue + ", 30%, 74%, " + alpha * 0.19 + ")";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      const age = now - particle.born;
      const progress = age / particle.lifetime;
      if (progress >= 1) {
        particles.splice(i, 1);
        continue;
      }
      const dt = delta / 16.67;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 0.004 * dt;
      const alpha = (1 - progress) * (reducedMotion ? 0.25 : 0.55);
      ctx.fillStyle = "hsla(" + particle.hue + ", 31%, 81%, " + alpha + ")";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 - progress * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }

    if (waves.length || particles.length || activeVisualNotes.size) requestDraw();
    else lastFrameTime = 0;
  }

  function requestDraw() {
    if (animationFrame || document.visibilityState === "hidden") return;
    animationFrame = window.requestAnimationFrame(drawResonance);
  }

  function setUpControls() {
    audioButton.addEventListener("click", () => {
      if (!audioContext) {
        const context = ensureAudio();
        if (context) {
          muted = false;
          if (masterGain) masterGain.gain.setTargetAtTime((muted ? 0 : volume / 100) * 0.78, context.currentTime, 0.025);
          if (context.state === "running") setAudioStatusReady();
        }
      } else {
        if (audioContext.state === "suspended") ensureAudio();
        setMuted(!muted);
      }
    });

    octaveDown.addEventListener("click", () => setOctave(octave - 1));
    octaveUp.addEventListener("click", () => setOctave(octave + 1));
    volumeSlider.addEventListener("input", (event) => setVolume(event.target.value));
    sustainButton.addEventListener("click", () => setSustain(!sustain));
    roomSlider.addEventListener("input", (event) => setRoomAmount(event.target.value));

    function setSettingsOpen(open) {
      settingsPanel.hidden = !open;
      settingsButton.setAttribute("aria-expanded", open ? "true" : "false");
      settingsButton.classList.toggle("is-open", open);
      if (open) roomSlider.focus({ preventScroll: true });
      else settingsButton.focus({ preventScroll: true });
    }
    settingsButton.addEventListener("click", () => setSettingsOpen(settingsPanel.hidden));
    settingsClose.addEventListener("click", () => setSettingsOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !settingsPanel.hidden) setSettingsOpen(false);
    });
  }

  function init() {
    readPreferences();
    renderKeyboard();
    setUpKeyboardShortcuts();
    setUpControls();
    resizeCanvas();
    updateAudioInterface();
    updateLiveReadout();

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(resizeCanvas);
      observer.observe($("#resonance-scene"));
    } else {
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }

    const motionChange = (event) => {
      reducedMotion = event.matches;
    };
    if (typeof reducedMotionQuery.addEventListener === "function") reducedMotionQuery.addEventListener("change", motionChange);
    else if (typeof reducedMotionQuery.addListener === "function") reducedMotionQuery.addListener(motionChange);

    document.addEventListener("contextmenu", (event) => {
      if (event.target.closest(".piano-key")) event.preventDefault();
    });
    firstFrame = false;
  }

  init();
})();
