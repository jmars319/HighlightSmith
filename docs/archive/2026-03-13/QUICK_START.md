# vaexcore pulse - Quick Start Guide

## 🎯 What You Have

A complete framework to build a local-first highlight detection tool for streamers:

- ✅ **Full specification** (product, architecture, pricing, roadmap)
- ✅ **Copilot instructions** (coding standards, best practices)
- ✅ **Working prototype** (Phase 0 - Python script)
- ✅ **Backend foundation** (Phase 1 - FastAPI service)

## ⚡ Get Started (5 minutes)

### Step 1: Read the Spec (5 min)
Open `VAEXCORE_PULSE_SPEC.md` - it's your product bible.

### Step 2: Test the Prototype (30 min)
```bash
cd vaexcore-pulse-prototype
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your OpenAI API key to .env

python analyze_vod.py /path/to/your/stream.mp4
```

**Goal:** See if it catches your actual highlights (60%+ accuracy needed)

### Step 3: Decision Point
- **Good accuracy?** → Continue to backend (Phase 1)
- **Poor accuracy?** → Tune weights/keywords in prototype first

## 📊 Validation Checklist

Test on 3-5 VODs and track:

- [ ] Top 10 suggestions are 60%+ accurate
- [ ] False positive rate <40%
- [ ] Catches your "best moments"
- [ ] Processing time <5 min per 4-hour VOD

## 🔧 Quick Tuning Guide

Edit `analyze_vod.py` (or `app/core/scoring.py` in backend):

**If missing loud/chaotic moments:**
```python
WEIGHTS = {
    'audio_energy': 0.35,  # ← Increase from 0.25
    'keyword_hits': 0.35,  # ← Increase from 0.30
    ...
}
```

**If missing your catchphrases:**
```python
CHAOS_KEYWORDS = [
    "oh no", "wait what",
    "your phrase here",  # ← Add these
]
```

**If too many false positives:**
- Increase window size from 10s to 15s
- Increase `speech_ratio` weight to filter silence

## 📁 What's in the Package

```
vaexcore-pulse/
├── README.md                    ← Master guide (you are here)
├── QUICK_START.md              ← This file
├── VAEXCORE_PULSE_SPEC.md      ← Complete specification
├── COPILOT_INSTRUCTIONS.md     ← AI assistant config
│
├── vaexcore-pulse-prototype/   ← Phase 0: Proof of concept
│   ├── analyze_vod.py         ← Main script (START HERE)
│   └── README.md
│
└── vaexcore-pulse-backend/     ← Phase 1: FastAPI service
    ├── app/                   ← Backend code
    │   ├── main.py           ← FastAPI entry
    │   ├── api/v1/analyze.py ← Analysis endpoint
    │   ├── core/scoring.py   ← Highlight logic
    │   └── ...
    └── README.md
```

## 🎬 Typical Development Flow

### Week 1-2: Validate
```bash
# Run prototype on your VODs
python analyze_vod.py stream1.mp4
python analyze_vod.py stream2.mp4
python analyze_vod.py stream3.mp4

# Manually check timestamps
# Tune weights if needed
# Repeat until 60%+ accurate
```

### Week 3-4: Backend
```bash
cd vaexcore-pulse-backend
uvicorn app.main:app --reload

# Test with curl/Postman
# Deploy to VPS (optional)
```

### Week 5-8: Desktop App
```bash
# Create Tauri project
npm create tauri-app

# Integrate with backend
# Build UI components
# Add export functionality
```

## 💰 Cost Expectations

**Development:**
- OpenAI testing: ~$20-50
- Your time: 20-40 hours

**Per-VOD:**
- Transcription: ~$1.50 per 4-hour stream
- Compute: <$0.01

**Monthly (if you charge users):**
- Server: $10-20/month
- Revenue potential: $500-2k/month (50-100 users × $10-20/month)

## 🚨 Decision Points

**After Phase 0:**
- Accuracy <50%? → Iterate on heuristics or abandon
- Accuracy >60%? → Proceed to Phase 1

**After Phase 1:**
- Can't deploy backend? → Consider serverless (Vercel, Railway)
- Backend works? → Proceed to Phase 2

**After Phase 2:**
- Get 10 users testing it
- If they use it weekly → Build Phase 3 features
- If they don't → Reassess product-market fit

## 🎯 Success Metrics

**Phase 0 (Prototype):**
- ✅ 60%+ accuracy on your VODs
- ✅ <5 min processing time
- ✅ You'd actually use this yourself

**Phase 1 (Backend):**
- ✅ API returns results in <3 min
- ✅ Handles 4-hour VODs without crashing
- ✅ Can be called from external apps

**Phase 2 (Desktop App):**
- ✅ Non-technical streamer can use it
- ✅ Exports clips successfully
- ✅ 5+ friends willing to test it

**Product-Market Fit:**
- ✅ 50+ paying users
- ✅ <20% monthly churn
- ✅ Users say it saves 2+ hours/week

## 🔗 Key Resources

- **Spec:** `VAEXCORE_PULSE_SPEC.md` (read this first)
- **Copilot Config:** `COPILOT_INSTRUCTIONS.md` (use with AI tools)
- **Prototype:** `vaexcore-pulse-prototype/README.md`
- **Backend:** `vaexcore-pulse-backend/README.md`

## ⚠️ Common Pitfalls

1. **Building UI before validating accuracy** → Test Phase 0 first!
2. **Over-engineering early** → Keep MVP simple
3. **Not testing on real VODs** → Use your actual streams
4. **Ignoring false positives** → They kill user trust
5. **Skipping the BYOK model** → Easiest monetization path

## 🎓 Learning Resources

- FastAPI: https://fastapi.tiangolo.com/tutorial/
- Tauri: https://tauri.app/v1/guides/getting-started/
- FFmpeg: https://ffmpeg.org/ffmpeg.html

## 🚀 Next Actions

1. [ ] Read `VAEXCORE_PULSE_SPEC.md` (30 min)
2. [ ] Set up prototype environment (10 min)
3. [ ] Test on first VOD (30 min)
4. [ ] Evaluate results and decide next step

---

**Remember:** This is a validation-driven project. Don't build Phase 2 until Phase 0 proves it works. Don't build Phase 3 until Phase 2 has real users.

Build → Test → Learn → Iterate

Good luck! 🎮✨
