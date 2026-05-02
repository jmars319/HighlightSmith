# vaexcore pulse - Visual Development Roadmap

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VAEXCORE_PULSE PROJECT ROADMAP                      │
│                                                                          │
│  Local-first highlight detection for Twitch/YouTube streamers          │
└─────────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 0: PROOF OF CONCEPT (1-2 weeks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────┐
│   VOD File   │
│  (mp4/mkv)   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│  analyze_vod.py          │
│  • Extract audio         │
│  • Detect scenes         │
│  • Transcribe (Whisper)  │
│  • Score highlights      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Console Output          │
│  Top 20 timestamps       │
│  + JSON file             │
└──────────────────────────┘

✅ DELIVERABLE: Python script that finds highlights
🎯 SUCCESS: 60%+ accuracy on your own VODs
⏱️  TIME: 1-2 weeks
💰 COST: ~$20-50 in OpenAI API testing

FILES TO USE:
├── vaexcore-pulse-prototype/
│   ├── analyze_vod.py      ← Main script
│   ├── requirements.txt
│   └── .env.example


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1: BACKEND API (1-2 weeks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────┐
│   Client Request     │
│   (audio + metadata) │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  FastAPI Backend (Cloud/VPS)         │
│  ┌────────────────────────────────┐  │
│  │ POST /api/v1/analyze           │  │
│  │  1. Receive audio features     │  │
│  │  2. Transcribe audio           │  │
│  │  3. Score segments             │  │
│  │  4. Return ranked highlights   │  │
│  └────────────────────────────────┘  │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────┐
│   JSON Response      │
│   List of segments   │
│   with scores        │
└──────────────────────┘

✅ DELIVERABLE: Working API endpoint
🎯 SUCCESS: Returns results in <3 minutes
⏱️  TIME: 1-2 weeks
💰 COST: $10-20/month VPS (optional)

FILES TO USE:
├── vaexcore-pulse-backend/
│   ├── app/
│   │   ├── main.py             ← FastAPI app
│   │   ├── api/v1/analyze.py   ← Endpoint logic
│   │   ├── core/scoring.py     ← Highlight scoring
│   │   └── services/           ← Whisper integration
│   └── requirements.txt


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2: DESKTOP APP (2-4 weeks) [NOT INCLUDED - YOU BUILD THIS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────────────────────────────────┐
│  Tauri Desktop App (Your Machine)                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  React Frontend (TypeScript)                           │  │
│  │  • File picker                                         │  │
│  │  • Progress display                                    │  │
│  │  • Highlight list/preview                              │  │
│  │  • Export controls                                     │  │
│  └────────────┬───────────────────────────────────────────┘  │
│               │                                               │
│  ┌────────────▼───────────────────────────────────────────┐  │
│  │  Rust Backend                                          │  │
│  │  • FFmpeg integration (extract audio, scenes)          │  │
│  │  • API client (send to backend)                        │  │
│  │  • Video export (cut clips locally)                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │                                    ▲
       │  Send features                    │  Receive highlights
       ▼                                    │
┌──────────────────────────────────────────┴───────────────────┐
│  Backend API (Phase 1)                                       │
└──────────────────────────────────────────────────────────────┘

✅ DELIVERABLE: Usable desktop application
🎯 SUCCESS: You can process VODs without touching code
⏱️  TIME: 2-4 weeks
💰 COST: Just your time

RECOMMENDED STACK:
- Framework: Tauri (Rust + TypeScript)
- Frontend: React + Tailwind CSS
- State: Zustand or React Context


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3: POLISH & LAUNCH (2-3 weeks) [FUTURE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Features to Add:
┌─────────────────────────────────────┐
│ • User accounts (optional)          │
│ • Usage tracking/limits             │
│ • Export templates (TikTok, etc)    │
│ • Batch processing                  │
│ • Better UI/UX polish               │
│ • Onboarding flow                   │
└─────────────────────────────────────┘

✅ DELIVERABLE: Shareable product
🎯 SUCCESS: 10+ users testing it
⏱️  TIME: 2-3 weeks
💰 COST: Marketing/distribution time


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHNOLOGY STACK OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backend (Phase 1):
├── Language: Python 3.11+
├── Framework: FastAPI
├── AI: OpenAI Whisper API
├── Processing: NumPy
└── Deploy: Any VPS (Hetzner, DigitalOcean, Railway)

Desktop App (Phase 2):
├── Framework: Tauri
├── Backend: Rust
├── Frontend: React + TypeScript
├── Styling: Tailwind CSS
├── Media: FFmpeg (bundled)
└── State: Zustand / React Context

Processing Pipeline:
├── Local: FFmpeg (audio extraction, scene detection, clipping)
├── Cloud: Whisper API (transcription)
├── Cloud: Python backend (highlight scoring)
└── Local: Video export


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING HEURISTIC (Core Algorithm)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Score(t) = Σ (weight × component)

Components:
┌────────────────────────┬─────────┬──────────────────────────────┐
│ Component              │ Weight  │ What It Detects              │
├────────────────────────┼─────────┼──────────────────────────────┤
│ Audio Energy           │ 0.25    │ Loud/chaotic moments         │
│ Scene Density          │ 0.20    │ Fast cuts/action sequences   │
│ Keyword Hits           │ 0.30    │ "oh shit", "yes!", etc       │
│ Speech Ratio           │ 0.15    │ Talking vs silence balance   │
│ Momentum Change        │ 0.10    │ Sudden energy shifts         │
└────────────────────────┴─────────┴──────────────────────────────┘

Tunable via:
- Phase 0: Edit WEIGHTS in analyze_vod.py
- Phase 1: Edit settings.WEIGHT_* in .env
- Runtime: Pass custom weights to API


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA FLOW (Full System)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. USER LOADS VOD
   │
   ├─> Desktop App: File picker
   └─> FFmpeg extracts:
       ├─ Audio (WAV, 16kHz mono)
       ├─ Scene boundaries (timestamps)
       └─ Waveform (RMS per second)

2. SEND TO BACKEND
   │
   └─> POST /api/v1/analyze
       Body: {
         audio: "base64...",
         scene_boundaries: [...],
         audio_features: {...}
       }

3. BACKEND PROCESSING
   │
   ├─> Whisper API: Transcribe audio → text + timestamps
   ├─> Scoring engine:
   │   ├─ Audio energy analysis
   │   ├─ Scene density calculation
   │   ├─ Keyword detection
   │   ├─ Speech ratio
   │   └─ Momentum changes
   └─> Sort & return top N segments

4. RECEIVE RESULTS
   │
   └─> Desktop App displays:
       ├─ Highlight list (sorted by score)
       ├─ Video player with timeline
       └─ Export controls

5. EXPORT CLIPS
   │
   └─> FFmpeg cuts clips locally
       └─> User saves to disk or uploads manually


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COST BREAKDOWN (Per 4-hour VOD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Transcription (Whisper API):
└─ 240 minutes × $0.006/min = $1.44

Compute (API server):
└─ Negligible (~$0.01)

Storage:
└─ None (video stays local)

TOTAL: ~$1.50 per VOD

Revenue Model (BYOK - Bring Your Own Key):
├─ Free tier: 5 hours/month with user's API key
├─ One-time: $49 for unlimited (user provides key)
└─ Premium: $9/month for advanced features

OR Subscription:
├─ Hobby: $9/mo → 10 hours
├─ Creator: $19/mo → 30 hours
└─ Power: $39/mo → 60 hours


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION TREE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

START HERE
    │
    ├─> Run Phase 0 prototype
    │   │
    │   ├─> Accuracy >60%?
    │   │   ├─ YES → Proceed to Phase 1 ✅
    │   │   └─ NO → Tune weights/keywords, retry
    │   │
    │   └─> Still <50% after tuning?
    │       └─ STOP: Heuristic approach won't work for your content
    │
    ├─> Build Phase 1 backend
    │   │
    │   ├─> API works end-to-end?
    │   │   ├─ YES → Proceed to Phase 2 ✅
    │   │   └─ NO → Debug, check logs
    │   │
    │   └─> Can't deploy backend?
    │       └─ Consider serverless (Vercel, Railway)
    │
    ├─> Build Phase 2 desktop app
    │   │
    │   ├─> Working end-to-end?
    │   │   ├─ YES → Get 10 users to test ✅
    │   │   └─ NO → Simplify scope, debug
    │   │
    │   └─> Too complex?
    │       └─ Consider web app instead of desktop
    │
    └─> Validate with users
        │
        ├─> Users find it valuable?
        │   ├─ YES → Build Phase 3 features ✅
        │   └─ NO → Reassess product-market fit
        │
        └─> Ready to monetize?
            ├─ Start with BYOK model
            └─ Add subscription tier later


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES PROVIDED IN THIS FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 Documentation:
├── README.md                   ← Master guide (start here)
├── QUICK_START.md             ← 5-minute quickstart
├── VAEXCORE_PULSE_SPEC.md     ← Complete specification
├── COPILOT_INSTRUCTIONS.md    ← AI coding assistant config
└── ROADMAP.md                 ← This file

🐍 Phase 0 (Prototype):
├── vaexcore-pulse-prototype/
│   ├── analyze_vod.py         ← Main analysis script
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md

🚀 Phase 1 (Backend):
└── vaexcore-pulse-backend/
    ├── app/
    │   ├── main.py            ← FastAPI entry point
    │   ├── api/v1/analyze.py  ← Analysis endpoint
    │   ├── core/
    │   │   ├── config.py      ← Settings
    │   │   └── scoring.py     ← Highlight logic
    │   ├── models/schemas.py  ← Pydantic models
    │   └── services/
    │       └── transcription.py
    ├── requirements.txt
    ├── .env.example
    └── README.md


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This Week:
└─ [ ] Read VAEXCORE_PULSE_SPEC.md
└─ [ ] Set up prototype environment
└─ [ ] Test on 1 VOD
└─ [ ] Evaluate accuracy

Next Week:
└─ [ ] Test on 4 more VODs
└─ [ ] Tune weights if needed
└─ [ ] Make go/no-go decision

If Validated:
└─ [ ] Set up backend
└─ [ ] Test API with curl
└─ [ ] Plan Phase 2 architecture

Remember:
• Build → Test → Learn → Iterate
• Don't skip validation phases
• Keep MVP scope tight
• Use provided Copilot instructions

Good luck! 🚀
```
