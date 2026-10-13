# NOCTURNE

A small, moonlit piano for the moments in between. NOCTURNE is a responsive, browser-based instrument with a restrained dark studio aesthetic and a note-reactive visual layer called **Resonance**.

## Run it

There is no build step, package manager, external font, runtime dependency, or sample download.

- Open `index.html` in a modern browser, or serve this directory with any static HTTP server.
- For public hosting, enable **GitHub Pages** for the repository's `main` branch and `/(root)`.
- Click **Wake the piano** or press any mapped note once to initialize browser audio. Browsers do not permit audio to start automatically before a user gesture.

## Play

The two rows of computer keys play two octaves. Hold notes to sustain their attack, release keys for the natural tail, and play multiple notes together for chords.

| Lower octave | Upper octave |
| --- | --- |
| `Z S X D C V G B H N J M` | `Q 2 W 3 E R 5 T 6 Y 7 U` |

- `[` / `]` shifts the full keyboard down/up an octave. The on-screen −/+ controls do the same.
- **Sustain** keeps released notes ringing until the pedal is switched off.
- **Master volume** changes the output level.
- **Room** changes the amount of a short, softly fed-back delay.
- Mouse, touch, and accessible keyboard activation of an individual piano key are supported.

Preferences for octave, volume, and room amount are stored locally when browser storage is available.

## Audio and visuals

The instrument uses one shared Web Audio engine with five harmonics per note, a quiet filtered hammer transient, a shaped decay/release envelope, a master compressor, and a modest room send. The sound is synthesized in-browser rather than downloaded from a sample library, so it remains self-contained and may not have the timbral detail of a recorded grand piano.

Resonance uses the played pitches and currently held notes to place expanding waves, fine particles, and a subtle chord-responsive ribbon. It does not run a decorative animation loop while idle. Reduced-motion preferences shorten and calm the visual response.

## Browser notes

A current Chromium, Firefox, or Safari browser with Web Audio support is recommended. Audio is initialized only after a user action. The page has no tracking, API keys, remote assets, or external network requirements.

The project began as an empty repository, so there was no pre-existing build, lint, test, or CI configuration to preserve.
