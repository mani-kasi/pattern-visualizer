# 👖 Pattern Visualizer
A 3D full-stack web app I built to test and visualize fabric patterns for my clothing brand **SEVR**.
It lets users upload patterns, preview them on a pair of pants, and adjust the scale in real time.
Built with React, Three.js, Node, and Supabase.

## ✨ Features
- Secure signup/login flow backed by a Node.js + Express API with JWT auth.
- Pattern library with built-in swatches plus user uploads stored on disk and indexed in PostgreSQL.
- Real-time scaling for seamless textures on the 3D pants model.
- Export the live canvas to a PNG image.
- Logout control and inline status messages for uploads, syncs, and model loading.

## 🧰 Tech Stack
- **Frontend:** React, TypeScript, Vite, Tailwind reset, React Three Fiber, Drei
- **Backend:** Node.js, Express, PostgreSQL (Supabase), Multer, JWT, bcrypt
- **3D Assets:** GLB pants model rendered with Three.js

## 🚀 Why I’m Building This
I’m starting a clothing brand, and one of the hardest parts of working with manufacturers is visualizing how a fabric pattern will actually look on a finished garment.

Instead of sending 2D swatches back and forth, this project lets me:
- Upload a pattern (cheetah print, tropical print, etc.).
- Apply it to a garment model.
- Adjust scaling/repeating.
- Share previews with manufacturers or collaborators.

More features coming soon. lighting controls, hue & saturation sliders, and multiple garment types.

Enjoy experimenting with new fabrics and extending the garment library! 🎨
