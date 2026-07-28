# MHT-CET Engineering College Predictor & Counselling Portal

A complete web platform and AI-powered prediction engine for MHT-CET engineering admissions in Maharashtra.

## 📁 Project Structure

```
├── backend/                  # FastAPI Python Backend (Auto-Deploys on Render)
│   ├── main.py
│   ├── requirements.txt
│   ├── Procfile
│   ├── Overall_MH_CAP_Cutoff_2025-26.csv
│   ├── Overall_AI_CAP_Cutoff_2025-26.csv
│   └── ... CSV datasets
│
├── frontend/                 # Static Web Frontend (Auto-Deploys on Netlify)
│   ├── index.html            # Main Portal Page
│   ├── predictor.html        # AI Choice Code Option Form Generator
│   ├── predictor.js
│   ├── Style.css
│   └── ... static assets & pages
│
├── run.py                    # Local development runner
└── README.md
```

---

## ⚡ Continuous Deployment & Auto-Update Workflow

Because your GitHub repo is connected to Render & Netlify, **every time you push new code to GitHub, both your Backend and Frontend will automatically re-deploy!**

### Standard Update Command:
Whenever you make updates to any page or code in the project, run:
```bash
git add .
git commit -m "Update feature / page changes"
git push origin main
```
- **Render** will automatically build & deploy changes in `backend/`.
- **Netlify** will automatically publish changes in `frontend/` within 60 seconds!

---

## 🛠️ Local Testing Before Pushing

Before pushing your continuous updates to GitHub, you can test everything locally on your PC:

```bash
python run.py
```
- `predictor.js` automatically detects when you are working locally (`127.0.0.1:8000`) vs when your site is live on Netlify, so local testing won't affect your production website.

---

## 🚀 Initial Setup Instructions

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial deployment setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. Connect Backend on Render
1. Go to [Render.com](https://render.com/) -> **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Set settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -k uvicorn.workers.UvicornWorker main:app`
4. Deploy service and copy your live backend URL (e.g. `https://your-backend.onrender.com`).

### 3. Connect Frontend on Netlify
1. Go to [Netlify.com](https://www.netlify.com/) -> **Add new site** -> **Import an existing project** -> **GitHub**.
2. Select your repository.
3. Set settings:
   - **Base directory**: `frontend`
   - **Publish directory**: `frontend`
   - **Build command**: *(leave empty)*
4. Click **Deploy Site**.

### 4. Link Live Backend to Frontend
In `frontend/predictor.js`, line 2 points to your Render API:
```javascript
const REMOTE_API = "https://YOUR-RENDER-BACKEND-NAME.onrender.com/api";
```
Paste your Render backend URL here once created, commit, and push!
