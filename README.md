# 🌍 Earth Visualizer

An interactive Three.js scene that renders a photorealistic Earth with real-time day/night lighting, atmospheric glow, and an animated starfield backdrop. Use the control panel to scrub through UTC time, tweak brightness levels, or toggle visual effects while orbiting smoothly around the planet.

[Live Demo](https://jeantimex.github.io/flights-tracker/)

## 🌟 Features
- **Photorealistic Earth** with high-resolution textures and subtle atmospheric scattering.
- **Dynamic Day/Night Cycle** driven by real-world UTC time or manual time control.
- **Animated Starfield** providing an immersive space backdrop.
- **HUD Overlay** showing FPS (Stats.js) and the latitude/longitude beneath the camera.
- **Responsive Orbit Controls** with an introductory camera animation and coordinate readout.

## 🎮 Controls
### GUI Panel (top right)
- **Lighting Controls**
  - `Day/Night Effect`: Enable physically-inspired lighting.
  - `Atmosphere Effect`: Toggle the glowing atmospheric shell.
  - `Real-time Sun`: Keep the sun synced to the current UTC time.
  - `Time Slider`: Scrub through a simulated day when real-time mode is off.
- **Brightness Controls**
  - `Day`: Adjust directional-light intensity.
  - `Night`: Adjust ambient-light intensity for the night side.

### Navigation
- **Mouse drag**: Orbit around the Earth.
- **Scroll**: Zoom in/out with clamped distance to avoid clipping.
- **Intro Animation**: Camera eases into position once textures finish loading.

### Status Display
- **FPS Counter**: Hidden during loading, shown once the scene is ready.
- **Coordinates**: Live latitude/longitude of the point directly under the camera.

## ⚡ Performance Notes
- Lightweight scene with only a handful of draw calls.
- Sun position updates are batched to minimize per-frame work.
- Starfield animation uses shader uniforms for smooth twinkling without heavy CPU updates.

## 🛠️ Technical Stack
- **Three.js** for WebGL rendering.
- **dat.GUI** for the control panel.
- **Stats.js** for live performance metrics.
- **Vite** for fast development and bundling.

## 🚀 Getting Started
### Prerequisites
- Modern browser with WebGL support.
- Local development server (required for loading textures).

### Installation
```bash
git clone https://github.com/jeantimex/flights-tracker.git
cd flights-tracker
npm install
```

### Development
```bash
npm run dev
```
Open the printed URL (defaults to `http://localhost:5173`).

### Production Build
```bash
npm run build
```

## 🔧 Configuration
- Adjust default brightness or sun behaviour inside `src/Controls.js`.
- Tweak camera defaults and intro animation timings in `src/main.js`.

## 🤝 Contributing
1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit changes: `git commit -m 'Add amazing feature'`.
4. Push to the branch: `git push origin feature/amazing-feature`.
5. Open a pull request.

## 📄 License
MIT — see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [jeantimex](https://github.com/jeantimex)
