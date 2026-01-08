# Pattern Visualizer
A 3D full-stack web app I built to test and visualize fabric patterns for my clothing brand, **SEVR**.
It lets users upload patterns, preview them on a pants model, tweak scale and lighting in real time, and export/share consistent previews before ordering samples.


## Demo
https://github.com/user-attachments/assets/372d0436-85fe-4059-972d-30060d73dba9




## Features
- Auth: signup/login backed by a Node.js and Express API with JWT
- Pattern library: built-in default swatches + user uploads (indexed in Postgres)
- 3D preview: real-time seamless texture scaling on a GLB pants model
- Studio mode: lighting presets (Studio Soft / Flat / Dramatic) and optional grid/axes helpers
- Export: save the live canvas to PNG (supports transparent background)
- Presets: save/load/delete presets and generate public share links (/s/:slug)


## Tech Stack
- **Frontend:** React, TypeScript, Vite, React Three Fiber, Drei
- **Backend:** Node.js, Express, PostgreSQL (Supabase), Multer, JWT, bcrypt
- **3D Assets:** GLB pants model rendered with Three.js


## Why I built this
I’m starting a clothing brand and when working with clothing samples, it’s hard to predict how a pattern will look like on an actual garment from a 2D mockup, especially under real lighting. Instead of repeatedly microadjusting the pattern's size and colour, wasting money and time on new samples, this tool helps me iterate faster on pattern scale, contrast, and the overall “feel” before sending decisions to manufacturing.


## How to Run Locally
You need a Postgres database and two terminals.

### 1) Backend API
```bash
cd server
npm install
```

Create `server/.env` with:
```
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=your-dev-secret
```

Run the SQL migration in Supabase SQL editor:
- server/sql/001_create_presets.sql

Start the API:
```bash
npm run dev
```

API runs on `http://localhost:4000` by default.

### 2) Frontend
```bash
cd ..
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

### Notes
- If you change the backend port, update src/constants/api.ts.
- CORS in server/index.js allows only http://localhost:5173 by default.
