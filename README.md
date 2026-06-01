# scrcpy-studio

A desktop GUI for [scrcpy](https://github.com/Genymobile/scrcpy) that exposes every
documented scrcpy feature through a clean, discoverable interface — while keeping scrcpy
itself a swappable, auto-updated binary.

scrcpy-studio is a **control surface**: you configure the mirror through panels, the app
builds the exact `scrcpy` command and launches it. scrcpy renders its own mirror window.
Because the app wraps the real binary instead of reimplementing its protocol, dropping in a
newer scrcpy gives you its newest features immediately — and a raw-args field lets you pass
any flag the UI doesn't expose yet.

> Status: early development. Windows first; macOS and Linux planned.

## Features

- **Auto-managed scrcpy** — downloads the latest scrcpy release, shows the installed version,
  one-click update. adb ships inside the scrcpy Windows release.
- **Every flag, UI-ed** — Connect, Video, Audio, Camera, Control, Input, Window, Record,
  Virtual display, and General panels covering the full `scrcpy --help` surface.
- **Live command preview** — every toggle updates the exact `scrcpy …` string; copy it anytime.
- **Device dock** — list/connect devices over USB and Wi-Fi (pair, tcpip, connect).
- **Sessions** — see running mirrors, watch their logs, stop them.
- **Profiles** — save and reload named configurations.
- **Raw args passthrough** — append any flags verbatim, so a newer scrcpy is never blocked
  by the UI.

## Tech stack

- [Tauri 2](https://tauri.app/) (Rust core)
- React + TypeScript + Vite frontend
- Tailwind CSS

## Development

Prerequisites: [Rust](https://rustup.rs/), [Node.js](https://nodejs.org/) 20+, and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev     # run the app in development
npm test              # frontend unit tests
cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit tests
npm run tauri build   # produce a release bundle
```

## Acknowledgements

- [scrcpy](https://github.com/Genymobile/scrcpy) by Genymobile — the engine this GUI drives.
- The floating device-control panel is inspired by
  [guiscrcpy](https://github.com/srevinsaju/guiscrcpy) (now archived).

## License

[MIT](./LICENSE)
