# ✈️ Flight Tracker 3D

A 3D simulation of global flight paths with dynamic day/night cycles, built with Three.js. Watch thousands of flights move across a photorealistic Earth with customizable controls and performance optimizations.

https://github.com/user-attachments/assets/a31ce178-a4ca-4692-94b4-429759189e8a

[Flight Tracker Demo](https://jeantimex.github.io/flights-tracker/)

## 🌟 Features

### Core Visualization
- **34,000+ Flight Paths**: Flight data simulation with dynamic curved trajectories
- **Instanced Aircraft**: Efficiently rendered 3D plane models with 8 different designs
- **Photorealistic Earth**: High-resolution textures with atmosphere effects
- **Day/Night Cycle**: Realistic sun positioning with dynamic lighting
- **Starfield Background**: Animated star field for immersive space experience

### Interactive Controls
- **Flight Count**: Adjust the number of visible flights (1-34,297)
- **Animation Speed**: Control flight animation speed (0.1x to 3.0x)
- **Plane Size**: Scale aircraft models (0.1x to 3.0x)
- **Show/Hide Elements**: Toggle flight paths, aircraft, and colorization
- **Lighting Controls**:
  - Real-time sun positioning or manual time control
  - Adjustable day/night brightness
  - Atmosphere effects toggle
- **Camera Controls**: Smooth orbit navigation with animated intro

### Visual Effects
- **Gradient Flight Paths**: Color-coded by origin longitude with fade effects
- **Realistic Flight Arcs**: Dynamic altitude curves based on distance
- **Plane Colorization**: 8 distinct color schemes for aircraft
- **Semi-transparent Elements**: Subtle opacity for visual depth

## 🎮 Controls

### GUI Panel (Top Right)
- **Plane Controls**
  - Size: Adjust aircraft scale
- **Animation Controls**
  - Speed: Control animation playback speed
- **Flight Controls**
  - Count: Number of visible flights
  - Show Paths: Toggle flight trajectory lines
  - Show Planes: Toggle aircraft visibility
  - Colorize: Enable/disable aircraft coloring
- **Lighting Controls**
  - Day/Night Effect: Realistic lighting simulation
  - Atmosphere Effect: Earth's atmospheric glow
  - Real-time Sun: Automatic sun positioning
  - Time Controls: Manual time adjustment
- **Brightness Controls**
  - Day/Night brightness levels

### Navigation
- **Mouse**: Click and drag to orbit around Earth
- **Scroll**: Zoom in/out
- **Initial Animation**: Cinematic camera intro with 1-second delay

### Status Display
- **FPS Counter**: Live performance monitoring (top left)
- **Coordinates**: Live lat/lng of camera center point (bottom right)

## ⚡ Performance Optimizations

### Rendering Efficiency
- **Instanced Rendering**: Single draw call for all aircraft using `THREE.InstancedMesh`
- **Merged Geometry**: Combined flight paths in single `LineSegments` mesh
- **Conditional Updates**: Skip expensive operations when elements are hidden
- **Draw Range Optimization**: Only render visible flight paths

### Animation Optimizations
- **Selective Processing**: Stop flight animations when planes are hidden
- **Matrix Caching**: Skip matrix calculations for invisible elements
- **Visibility Checks**: Early returns prevent unnecessary GPU operations
- **Buffer Reuse**: Pre-allocated geometry buffers for maximum efficiency

### Memory Management
- **Geometry Sharing**: Reused plane geometry across instances
- **Texture Optimization**: SVG-to-canvas texture pipeline
- **Efficient Data Structures**: Float32Arrays for position/color data

## 🛠️ Technical Stack

- **Three.js**: 3D graphics and WebGL rendering
- **dat.GUI**: Interactive control panel
- **Stats.js**: Performance monitoring
- **Vanilla JavaScript**: ES6 modules with clean architecture

## 🚀 Getting Started

### Prerequisites
- Modern web browser with WebGL support
- Local development server (due to CORS restrictions)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jeantimex/flights-tracker.git
   cd flights-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173` (or your configured port)

### Building for Production

```bash
npm run build
```

## 🔧 Configuration

### Flight Data
- Located in `src/Data.js`
- Format: Array of objects with `departure`, `arrival`, and `speed` properties
- Coordinates in decimal degrees (latitude/longitude)

### Performance Tuning
- Adjust `maxFlightCount` in Controls.js for different datasets
- Modify `instancedPlanes` count for memory optimization
- Configure `pointsPerPath` in MergedFlightPaths.js for path detail

## 📊 Performance Metrics

- **Rendering**: 60 FPS with 34,000+ flight simulation on modern hardware
- **Memory**: ~200MB RAM usage for full dataset
- **Draw Calls**: Minimized to ~10 calls per frame
- **Optimization**: 90%+ performance improvement when elements hidden

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [jeantimex](https://github.com/jeantimex)
