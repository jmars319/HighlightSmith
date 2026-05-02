# vaexcore pulse - Project Specification

**Version:** 0.1.0  
**Target:** Solo developer with AI coding assistants  
**Status:** Pre-development framework

---

## Executive Summary

**Product in one sentence:**  
Local-first highlight assistant for streamers: analyze VODs on your machine with cloud-assisted scoring, get ranked highlight suggestions and ready-to-export clips without uploading full videos.

**Target User:**  
Twitch/YouTube streamers (10-100 avg viewers) who stream 20-60 hours/month and want automated highlight detection without:
- Uploading full VODs to third-party servers
- Paying per-minute SaaS fees
- Using tools optimized for battle royales instead of narrative/chaotic gaming

**Core Value Proposition:**
- Works with long VODs (4+ hours)
- Privacy-first: video never leaves your machine
- Cheaper than minutes-based SaaS
- Optimized for narrative/chaotic gaming content

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     DESKTOP APP (LOCAL)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Load VOD from disk (mp4/mkv/mov)                   │ │
│  │  2. Extract features using ffmpeg:                     │ │
│  │     - Audio (48kHz mono AAC)                          │ │
│  │     - Waveform/loudness data                          │ │
│  │     - Scene change timestamps                         │ │
│  │     - Optional low-res thumbnails                     │ │
│  │  3. Send compressed features to cloud                 │ │
│  │  4. Receive highlight candidates                      │ │
│  │  5. Allow user preview/adjustment                     │ │
│  │  6. Export clips locally via ffmpeg                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
                  (features / results)
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API (CLOUD)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Receive feature payload                           │ │
│  │  2. Run speech-to-text (Whisper API or self-hosted)   │ │
│  │  3. Score segments for "interestingness":             │ │
│  │     - Audio energy spikes                             │ │
│  │     - Scene change density                            │ │
│  │     - Transcript keywords                             │ │
│  │     - Speaking vs silence patterns                    │ │
│  │  4. Return ranked highlight candidates                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** Full video file never uploaded. Only lightweight features (audio, metadata, timestamps) sent to cloud.

---

## Technology Stack

### Desktop Application
- **Framework:** Tauri (Rust backend, TypeScript/React frontend)
  - Alternative: Electron if Tauri proves too complex
- **Frontend:** React + Tailwind CSS
- **Media Processing:** ffmpeg (called via Rust bindings or Node.js)
- **State Management:** React Context or Zustand

**Why Tauri:**
- Smaller binary size vs Electron
- Better performance
- Native OS integration
- You're learning Rust anyway

### Backend API
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** PostgreSQL (for user/usage tracking later)
- **File Storage:** Local filesystem initially, S3-compatible for transcripts later

**Why Python/FastAPI:**
- Excellent AI/ML tooling ecosystem
- Fast async performance
- Easy to deploy
- Great documentation
- AI coding assistants love it

### AI/Processing Pipeline
**Transcription:**
- MVP: OpenAI Whisper API
- Future: Self-hosted Whisper or whisper.cpp

**Feature Extraction (local):**
- `ffmpeg` for audio extraction
- `ffmpeg` scene detection: `-vf select='gt(scene,0.3)'`
- Audio loudness: `-af volumedetect` or Python waveform analysis

**Highlight Scoring (backend):**
- MVP: Heuristic scoring (NumPy/SciPy)
- Future: Small transformer/LSTM classifier

---

## Development Phases

### Phase 0: Proof of Concept (1-2 weeks)
**Goal:** Validate that heuristic scoring can identify actual highlights

**Deliverable:** Single Python script that:
1. Takes local video path as input
2. Uses ffmpeg to extract audio + scene changes
3. Sends audio to Whisper API → gets transcript
4. Runs scoring heuristic
5. Prints timestamp list to console

**Success criteria:** Manually verify it catches 60%+ of actual highlights from your own VODs

**Files to create:**
```
prototype/
├── analyze_vod.py          # Main script
├── requirements.txt        # Dependencies
├── .env.example           # API key template
└── README.md              # Setup instructions
```

### Phase 1: Minimal Backend (1-2 weeks)
**Goal:** Wrap prototype in a working API

**Deliverable:** FastAPI service with single endpoint:
```
POST /api/v1/analyze
Request: audio file + scene_boundaries JSON + metadata
Response: {segments: [{start, end, score, label, description}]}
```

**Features:**
- Synchronous processing (async later)
- No authentication yet
- Basic error handling
- Logging to stdout

**Files to create:**
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI app entry
│   ├── api/
│   │   └── v1/
│   │       └── analyze.py # Analysis endpoint
│   ├── core/
│   │   ├── config.py      # Settings
│   │   └── scoring.py     # Highlight scoring logic
│   ├── models/
│   │   └── schemas.py     # Pydantic models
│   └── services/
│       ├── transcription.py
│       └── feature_extraction.py
├── requirements.txt
├── .env.example
└── README.md
```

### Phase 2: Desktop App MVP (2-4 weeks)
**Goal:** Usable application for personal use

**Deliverable:** Tauri app with:
- File picker for VOD selection
- Progress UI (extracting → uploading → analyzing → complete)
- Simple table of suggested highlights
- Basic video player with trim controls
- Export button to cut clips locally

**Features:**
- Settings: API endpoint URL, optional API key
- Basic error handling
- Simple persistent config (JSON file)

**Files to create:**
```
desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs        # Tauri main
│   │   ├── ffmpeg.rs      # FFmpeg wrapper
│   │   └── api.rs         # Backend API client
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/
│   │   ├── FileSelector.tsx
│   │   ├── ProgressDisplay.tsx
│   │   ├── HighlightList.tsx
│   │   ├── VideoPlayer.tsx
│   │   └── ExportControls.tsx
│   ├── hooks/
│   │   ├── useAnalysis.ts
│   │   └── useExport.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── README.md
```

### Phase 3: Product Polish (2-3 weeks)
**Goal:** Shareable product with basic monetization

**Features to add:**
- User accounts (optional, for usage tracking)
- Usage limits/tokens
- Better UI/UX polish
- Onboarding flow
- Export templates (TikTok safe areas, etc.)
- Error recovery

### Phase 4+: Future Enhancements
- Direct platform uploads (TikTok, YouTube Shorts)
- Batch processing multiple VODs
- Custom scoring profiles per game/content type
- Training data collection for ML model
- Mobile companion app for on-the-go review

---

## API Contract Specification

### POST /api/v1/analyze

**Request:**
```json
{
  "audio": "base64_encoded_audio_data",
  "metadata": {
    "duration_seconds": 14420,
    "fps": 60,
    "resolution": "1920x1080",
    "source_filename": "stream_2024-11-15.mp4"
  },
  "scene_boundaries": [
    {"timestamp": 12.5, "score": 0.65},
    {"timestamp": 145.2, "score": 0.82},
    {"timestamp": 312.8, "score": 0.71}
  ],
  "audio_features": {
    "waveform": [0.2, 0.3, 0.8, ...],  // Normalized loudness per second
    "sample_rate": 48000
  }
}
```

**Response:**
```json
{
  "analysis_id": "uuid-here",
  "segments": [
    {
      "start": 145.0,
      "end": 165.0,
      "score": 0.89,
      "label": "chaos_spike",
      "description": "High energy moment with yelling and scene changes",
      "tags": ["audio_spike", "scene_changes", "keywords_detected"],
      "transcript_snippet": "oh no no no wait what the—"
    },
    {
      "start": 2340.5,
      "end": 2365.0,
      "score": 0.85,
      "label": "mission_success",
      "description": "Success moment with celebration",
      "tags": ["achievement_keywords", "energy_shift"],
      "transcript_snippet": "YES! Finally! That was insane!"
    }
  ],
  "metadata": {
    "total_segments_found": 23,
    "returned_segments": 10,
    "processing_time_seconds": 45.2,
    "transcription_method": "whisper-api",
    "model_version": "v0.1.0"
  }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "TRANSCRIPTION_FAILED",
    "message": "Whisper API returned 500 error",
    "details": "Retry in 30 seconds"
  }
}
```

---

## Scoring Heuristic (v0.1)

### Formula

```
Score(t) = w1 * audio_energy(t) 
         + w2 * scene_density(t) 
         + w3 * keyword_hits(t) 
         + w4 * speech_ratio(t)
         + w5 * momentum_change(t)
```

### Component Definitions

**1. Audio Energy (w1 = 0.25)**
```python
def audio_energy(waveform, window_start, window_size=10):
    """
    Normalized RMS energy in window.
    Returns 0-1 score.
    """
    window = waveform[window_start:window_start + window_size]
    rms = np.sqrt(np.mean(window ** 2))
    return min(rms / baseline_rms, 1.0)
```

**2. Scene Density (w2 = 0.20)**
```python
def scene_density(scene_boundaries, window_start, window_size=10):
    """
    Number of scene changes in window, normalized.
    Returns 0-1 score.
    """
    scenes_in_window = [
        s for s in scene_boundaries 
        if window_start <= s['timestamp'] < window_start + window_size
    ]
    # More than 3 scenes in 10 seconds = max score
    return min(len(scenes_in_window) / 3.0, 1.0)
```

**3. Keyword Hits (w3 = 0.30)**
```python
CHAOS_KEYWORDS = [
    "oh no", "wait what", "oh shit", "no no no",
    "what the", "are you kidding", "oh my god",
    "jesus christ", "holy shit"
]

SUCCESS_KEYWORDS = [
    "yes!", "finally!", "got it", "let's go",
    "that was", "perfect", "nice", "sick"
]

REACTION_KEYWORDS = [
    "wait", "hold on", "okay okay", "alright",
    "here we go", "oh boy"
]

def keyword_hits(transcript_segment):
    """
    Returns 0-1 based on keyword matches.
    Chaos keywords weighted higher for your content.
    """
    text = transcript_segment.lower()
    score = 0.0
    
    for kw in CHAOS_KEYWORDS:
        if kw in text:
            score += 0.4
    
    for kw in SUCCESS_KEYWORDS:
        if kw in text:
            score += 0.3
    
    for kw in REACTION_KEYWORDS:
        if kw in text:
            score += 0.1
    
    return min(score, 1.0)
```

**4. Speech Ratio (w4 = 0.15)**
```python
def speech_ratio(transcript_segment, window_size=10):
    """
    Ratio of speaking time vs silence.
    Too much silence = boring, but some silence = setup.
    Sweet spot: 40-80% speaking.
    """
    speaking_duration = calculate_speaking_duration(transcript_segment)
    ratio = speaking_duration / window_size
    
    # Penalize extremes
    if ratio < 0.2 or ratio > 0.95:
        return 0.0
    
    # Reward sweet spot
    if 0.4 <= ratio <= 0.8:
        return 1.0
    
    return 0.5
```

**5. Momentum Change (w5 = 0.10)**
```python
def momentum_change(audio_energy_series, current_idx):
    """
    Detects sudden energy shifts (calm → chaos or chaos → calm).
    Both are interesting for highlights.
    """
    if current_idx < 5:
        return 0.0
    
    prev_avg = np.mean(audio_energy_series[current_idx-5:current_idx])
    curr_energy = audio_energy_series[current_idx]
    
    delta = abs(curr_energy - prev_avg)
    return min(delta / 0.5, 1.0)  # Normalize to 0-1
```

### Default Weights
```python
WEIGHTS = {
    'audio_energy': 0.25,
    'scene_density': 0.20,
    'keyword_hits': 0.30,
    'speech_ratio': 0.15,
    'momentum_change': 0.10
}
```

**Tuning strategy:**
1. Test on 5 of your own VODs
2. Manually mark "good highlights"
3. Adjust weights to maximize true positives
4. Iterate

### Label Assignment
```python
def assign_label(segment_scores):
    """
    Assign human-readable label based on dominant features.
    """
    if segment_scores['keyword_hits'] > 0.7 and 'chaos' in keywords:
        return 'chaos_spike'
    
    if segment_scores['keyword_hits'] > 0.7 and 'success' in keywords:
        return 'mission_success'
    
    if segment_scores['scene_density'] > 0.7:
        return 'action_sequence'
    
    if segment_scores['momentum_change'] > 0.8:
        return 'energy_shift'
    
    return 'general_highlight'
```

---

## Pricing Model

### Cost Structure (Estimates)

**Transcription (Whisper API):**
- ~$0.006 per minute
- 4-hour VOD = 240 minutes = $1.44

**Compute (AWS/DO/Hetzner):**
- Small API server: $10-20/month
- Can handle 50-100 analyses/month easily

**Total cost per 4-hour VOD:** ~$1.50

### Proposed Tiers

**Option A: Subscription**
- **Hobby:** $9/month - 10 hours analysis
- **Creator:** $19/month - 30 hours analysis  
- **Power:** $39/month - 60 hours analysis

**Option B: BYOK (Bring Your Own Key)**
- **Free tier:** 5 hours/month with your OpenAI key
- **One-time license:** $49 - Unlimited with your API keys
- **Premium features:** $9/month - Advanced export templates, batch processing

**Recommended for MVP:** Option B (BYOK)
- Lower risk (no variable costs)
- Appeals to technical streamers
- Easier to validate market
- Can always add subscription later

---

## Success Metrics

### Phase 0 Validation
- [ ] Script catches 60%+ of manually-identified highlights
- [ ] False positive rate < 40%
- [ ] Processing time < 5 minutes for 4-hour VOD

### MVP Success (3 months post-launch)
- [ ] 10+ active users (friends/early adopters)
- [ ] 80%+ of users analyze at least 2 VODs
- [ ] Average processing time < 3 minutes
- [ ] User feedback: "saves me 2+ hours per week"

### Market Validation (6 months)
- [ ] 50+ paying users
- [ ] MRR > $500
- [ ] Churn rate < 20%/month
- [ ] 3+ testimonials from users

---

## Risk Mitigation

### Technical Risks

**Risk:** Heuristics don't work well enough
- **Mitigation:** Phase 0 validation before building UI
- **Fallback:** Allow manual adjustment + collect training data for ML model

**Risk:** Processing takes too long
- **Mitigation:** Chunk analysis, show progressive results
- **Fallback:** Offer "queue for overnight processing"

**Risk:** ffmpeg complexity across platforms
- **Mitigation:** Bundle static ffmpeg binaries with Tauri app
- **Fallback:** Require user to install ffmpeg separately

### Market Risks

**Risk:** Niche is too small
- **Mitigation:** Build for yourself first, validate with 10 streamers before scaling
- **Fallback:** Open source it, build reputation

**Risk:** Existing tools improve to match features
- **Mitigation:** Focus on local-first privacy angle
- **Fallback:** Pivot to complementary features (highlight editing, thumbnail generation)

**Risk:** Burn out before completion
- **Mitigation:** Keep MVP scope tight, celebrate small wins
- **Fallback:** Release what you have as open source

---

## Next Steps (Immediate)

### Week 1-2: Phase 0 Prototype
1. Set up Python environment
2. Get OpenAI API key for Whisper
3. Build analyze_vod.py script
4. Test on 3-5 of your own VODs
5. Manually validate results

**Decision point:** If < 50% accuracy, iterate on heuristics before proceeding.

### Week 3-4: Backend Foundation
1. Set up FastAPI project structure
2. Build /analyze endpoint
3. Add basic error handling
4. Test with Postman/curl
5. Deploy to cheap VPS (Hetzner/DO)

### Week 5-8: Desktop App
1. Set up Tauri + React project
2. Build file picker + ffmpeg integration
3. Connect to backend API
4. Build basic UI for results
5. Test end-to-end with real VODs

**Decision point:** If the tool saves you 30+ minutes on a real VOD, continue. If not, reassess.

---

## Questions to Answer During Development

1. **Optimal segment length:** 15-60 seconds or variable based on content?
2. **Overlap handling:** Can highlights overlap or must they be discrete?
3. **Export formats:** Just MP4, or also WebM/GIF/vertical formats?
4. **Thumbnail generation:** Should we auto-generate thumbnails for each highlight?
5. **Batch processing:** Allow multiple VODs in queue or force sequential?

---

## Appendix: Useful Commands

### FFmpeg Snippets

**Extract audio:**
```bash
ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 48000 -ac 1 output.wav
```

**Detect scene changes:**
```bash
ffmpeg -i input.mp4 -vf select='gt(scene,0.3)',metadata=print:file=scenes.txt -f null -
```

**Cut clip:**
```bash
ffmpeg -i input.mp4 -ss 00:02:30 -to 00:03:00 -c copy output.mp4
```

**Get video info:**
```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 input.mp4
```

### Development Workflow

**Backend dev:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Desktop dev:**
```bash
cd desktop
npm install
npm run tauri dev
```

**Build for production:**
```bash
npm run tauri build
```

---

**Document version:** 0.1.0  
**Last updated:** 2024-11-16  
**Author:** Jason (JAMARQ Digital)
