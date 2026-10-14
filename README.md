# NOCTURNE

A small, moonlit piano for the moments in between. NOCTURNE is a responsive, browser-based instrument with a restrained dark studio aesthetic and a note-reactive visual layer called **Resonance**.

## Run it

There is no build step or package manager. The instrument uses native Web Audio and loads recorded Salamander Grand Piano samples from the Tone.js sample host; the browser can cache them after the first play.

- Open `index.html` in a modern browser, or serve this directory with any static HTTP server.
- For public hosting, enable **GitHub Pages** for the repository's `main` branch and `/(root)`.
- Click **Wake the piano** or press any mapped note once to initialize browser audio. Recorded piano samples begin loading after that interaction; the keyboard remains playable while the sample range loads.

## Play

The two rows of computer keys play two octaves. Hold notes to sustain their attack, release keys for the natural tail, and play multiple notes together for chords.

| Lower octave | Upper octave |
| --- | --- |
| `Z S X D C V G B H N J M` | `Q 2 W 3 E R 5 T 6 Y 7 U` |

- `[` / `]` shifts the full keyboard down/up an octave. The on-screen −/+ controls do the same.
- **Sustain** keeps released notes ringing until the pedal is switched off.
- **Master volume** changes the output level.
- **Room** changes the level of a soft convolution-style room reverb.
- Mouse, touch, and accessible keyboard activation of an individual piano key are supported.

Preferences for octave, volume, and room amount are stored locally when browser storage is available.

## Audio and visuals

The primary instrument uses recorded notes from the Salamander Grand Piano sample set by Alexander Holm, hosted by Tone.js. The closest recorded pitch is gently resampled to cover missing semitones across the keyboard, with polyphonic voices, note-release envelopes, a master compressor, and a generated convolution-style room impulse. If sample loading fails or the site is used offline, the previous lightweight oscillator instrument remains available as a fallback.

Resonance uses the played pitches and currently held notes to place expanding waves, fine particles, and a subtle chord-responsive ribbon. It does not run a decorative animation loop while idle. Reduced-motion preferences shorten and calm the visual response.

## Browser notes

A current Chromium, Firefox, or Safari browser with Web Audio support is recommended. Audio is initialized only after a user action. Piano sample loading requires an internet connection to the Tone.js sample host; decoded samples are reused during the session and may be cached by the browser. No tracking or API keys are used.

