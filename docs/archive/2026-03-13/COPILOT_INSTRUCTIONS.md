# GitHub Copilot Instructions for vaexcore pulse

## Project Overview

vaexcore pulse is a local-first video highlight detection tool for Twitch/YouTube streamers. It analyzes VOD files locally, sends lightweight features to a cloud backend for AI-powered highlight scoring, and allows users to export clips without uploading full videos.

**Key Architecture:**
- **Desktop App:** Tauri (Rust + React/TypeScript) - handles video processing locally
- **Backend API:** FastAPI (Python) - processes features and scores highlights
- **Processing:** FFmpeg for media manipulation, OpenAI Whisper for transcription

## Code Style and Conventions

### General Principles
- **Prefer simplicity over cleverness** - This is a solo dev project; prioritize readability
- **Type everything** - Use TypeScript strictly, Python type hints everywhere
- **Fail fast with clear errors** - User-friendly error messages, detailed logging for debugging
- **Test as you go** - Write tests for core logic (scoring, parsing, API endpoints)

### Python (Backend)

**Style:**
- Follow PEP 8 with max line length of 100 characters
- Use `black` for formatting, `ruff` for linting
- Prefer dataclasses and Pydantic models over dictionaries
- Use async/await for I/O operations

**Naming:**
- Functions: `snake_case` - descriptive, verb-based (`calculate_highlight_score`)
- Classes: `PascalCase` - noun-based (`HighlightSegment`, `TranscriptionService`)
- Constants: `UPPER_SNAKE_CASE` - grouped by purpose (`CHAOS_KEYWORDS`, `DEFAULT_WEIGHTS`)
- Private functions: `_leading_underscore` - internal helpers only

**Imports:**
```python
# Standard library
import os
from typing import List, Dict, Optional

# Third party
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np

# Local
from app.core.config import settings
from app.services.transcription import transcribe_audio
```

**Error Handling:**
```python
# Good - specific, actionable errors
raise ValueError(f"Scene boundary timestamp {ts} exceeds video duration {duration}")

# Bad - generic, unhelpful
raise Exception("Invalid input")
```

**Type Hints:**
```python
def calculate_score(
    audio_energy: np.ndarray,
    scene_boundaries: List[Dict[str, float]],
    transcript: str,
    weights: Optional[Dict[str, float]] = None
) -> float:
    """
    Calculate highlight score for a segment.
    
    Args:
        audio_energy: Normalized RMS values per second
        scene_boundaries: List of {timestamp: float, score: float}
        transcript: Text from speech-to-text
        weights: Optional custom weights, defaults to WEIGHTS
    
    Returns:
        Score between 0.0 and 1.0
    """
```

### TypeScript/React (Desktop App)

**Style:**
- Use functional components with hooks (no class components)
- Prefer named exports over default exports
- Use `const` by default, `let` only when reassignment needed
- Max line length: 100 characters

**Naming:**
- Components: `PascalCase` - noun-based (`HighlightList`, `VideoPlayer`)
- Functions/variables: `camelCase` - descriptive (`calculateProgress`, `isProcessing`)
- Hooks: `use` prefix (`useAnalysis`, `useVideoExport`)
- Constants: `UPPER_SNAKE_CASE` - (`MAX_UPLOAD_SIZE`, `API_BASE_URL`)

**Component Structure:**
```typescript
// Good structure
interface HighlightListProps {
  segments: HighlightSegment[];
  onSegmentSelect: (segment: HighlightSegment) => void;
  isLoading?: boolean;
}

export function HighlightList({ 
  segments, 
  onSegmentSelect,
  isLoading = false 
}: HighlightListProps) {
  // Hooks first
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Event handlers
  const handleClick = (segment: HighlightSegment) => {
    setSelectedId(segment.id);
    onSegmentSelect(segment);
  };
  
  // Early returns
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  // Main render
  return (
    <div className="space-y-2">
      {segments.map(segment => (
        <HighlightCard 
          key={segment.id}
          segment={segment}
          onClick={handleClick}
          isSelected={selectedId === segment.id}
        />
      ))}
    </div>
  );
}
```

**Types:**
```typescript
// Define shared types in types/index.ts
export interface HighlightSegment {
  id: string;
  start: number;
  end: number;
  score: number;
  label: HighlightLabel;
  description: string;
  tags: string[];
  transcriptSnippet?: string;
}

export type HighlightLabel = 
  | 'chaos_spike'
  | 'mission_success'
  | 'action_sequence'
  | 'energy_shift'
  | 'general_highlight';

export interface VideoMetadata {
  durationSeconds: number;
  fps: number;
  resolution: string;
  sourceFilename: string;
}
```

### Rust (Tauri Backend)

**Style:**
- Follow Rust idioms (prefer `match` over `if let` chains)
- Use `?` operator for error propagation
- Prefer `&str` for function parameters, `String` for ownership
- Group related functionality into modules

**Naming:**
- Functions: `snake_case` - verb-based (`extract_audio`, `detect_scenes`)
- Types/Structs: `PascalCase` - noun-based (`VideoMetadata`, `FFmpegCommand`)
- Constants: `UPPER_SNAKE_CASE` - (`DEFAULT_SAMPLE_RATE`, `SCENE_THRESHOLD`)

**Error Handling:**
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FFmpegError {
    #[error("FFmpeg executable not found in PATH")]
    ExecutableNotFound,
    
    #[error("Failed to extract audio: {0}")]
    AudioExtraction(String),
    
    #[error("Invalid video file: {0}")]
    InvalidFile(String),
}

// Usage
pub fn extract_audio(video_path: &str) -> Result<Vec<u8>, FFmpegError> {
    let output = Command::new("ffmpeg")
        .args(&["-i", video_path, "-vn", "-"])
        .output()
        .map_err(|e| FFmpegError::AudioExtraction(e.to_string()))?;
    
    Ok(output.stdout)
}
```

## Project-Specific Guidelines

### FFmpeg Integration

**Always:**
- Check if ffmpeg is available before operations
- Use absolute paths for file operations
- Validate inputs (file exists, readable, valid format)
- Stream large outputs instead of loading into memory
- Log full ffmpeg commands for debugging

**Example:**
```rust
// Check availability
pub fn check_ffmpeg() -> Result<(), FFmpegError> {
    Command::new("ffmpeg")
        .arg("-version")
        .output()
        .map_err(|_| FFmpegError::ExecutableNotFound)?;
    Ok(())
}

// Extract with validation
pub fn extract_audio(video_path: &Path) -> Result<Vec<u8>, FFmpegError> {
    // Validate input
    if !video_path.exists() {
        return Err(FFmpegError::InvalidFile("File does not exist".into()));
    }
    
    // Log command for debugging
    let args = vec![
        "-i", video_path.to_str().unwrap(),
        "-vn", "-acodec", "pcm_s16le",
        "-ar", "48000", "-ac", "1",
        "-f", "wav", "-"
    ];
    log::debug!("Running ffmpeg with args: {:?}", args);
    
    let output = Command::new("ffmpeg")
        .args(&args)
        .output()
        .map_err(|e| FFmpegError::AudioExtraction(e.to_string()))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(FFmpegError::AudioExtraction(stderr.to_string()));
    }
    
    Ok(output.stdout)
}
```

### API Communication

**Backend endpoints should:**
- Accept JSON payloads (not multipart form data unless necessary)
- Return consistent error format
- Include request IDs for tracing
- Validate inputs with Pydantic
- Use appropriate status codes (400 for validation, 500 for server errors, 429 for rate limits)

**Example:**
```python
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, validator
import logging

logger = logging.getLogger(__name__)

class AnalyzeRequest(BaseModel):
    audio: str  # base64 encoded
    metadata: VideoMetadata
    scene_boundaries: List[SceneBoundary]
    
    @validator('audio')
    def validate_audio_size(cls, v):
        # Rough check: base64 is ~1.33x original size
        estimated_bytes = len(v) * 0.75
        max_bytes = 100 * 1024 * 1024  # 100MB
        if estimated_bytes > max_bytes:
            raise ValueError(f"Audio data too large: {estimated_bytes/1024/1024:.1f}MB")
        return v

@app.post("/api/v1/analyze")
async def analyze_video(request: AnalyzeRequest):
    try:
        logger.info(f"Processing analysis for {request.metadata.source_filename}")
        
        # Decode audio
        audio_bytes = base64.b64decode(request.audio)
        
        # Process
        segments = await process_analysis(audio_bytes, request)
        
        return {
            "segments": segments,
            "metadata": {
                "total_segments_found": len(segments),
                "processing_time_seconds": elapsed
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal processing error"
        )
```

### Highlight Scoring Logic

**Guidelines:**
- Keep weights configurable (easy to tune)
- Normalize all component scores to 0-1 range
- Document the reasoning behind thresholds
- Make it easy to add new scoring components
- Log intermediate scores for debugging

**Example:**
```python
from dataclasses import dataclass
from typing import Dict, List
import numpy as np

@dataclass
class ScoringWeights:
    audio_energy: float = 0.25
    scene_density: float = 0.20
    keyword_hits: float = 0.30
    speech_ratio: float = 0.15
    momentum_change: float = 0.10
    
    def validate(self):
        total = sum([
            self.audio_energy,
            self.scene_density,
            self.keyword_hits,
            self.speech_ratio,
            self.momentum_change
        ])
        assert abs(total - 1.0) < 0.01, f"Weights must sum to 1.0, got {total}"

def calculate_highlight_score(
    window_start: float,
    window_size: float,
    audio_waveform: np.ndarray,
    scene_boundaries: List[Dict],
    transcript: str,
    weights: ScoringWeights = ScoringWeights()
) -> Dict[str, float]:
    """
    Calculate composite highlight score for a time window.
    
    Returns dict with component scores and final score.
    """
    weights.validate()
    
    # Calculate each component (0-1 normalized)
    audio_score = calculate_audio_energy(audio_waveform, window_start, window_size)
    scene_score = calculate_scene_density(scene_boundaries, window_start, window_size)
    keyword_score = calculate_keyword_hits(transcript)
    speech_score = calculate_speech_ratio(transcript, window_size)
    momentum_score = calculate_momentum_change(audio_waveform, window_start)
    
    # Weighted sum
    final_score = (
        weights.audio_energy * audio_score +
        weights.scene_density * scene_score +
        weights.keyword_hits * keyword_score +
        weights.speech_ratio * speech_score +
        weights.momentum_change * momentum_score
    )
    
    return {
        'final_score': final_score,
        'components': {
            'audio_energy': audio_score,
            'scene_density': scene_score,
            'keyword_hits': keyword_score,
            'speech_ratio': speech_score,
            'momentum_change': momentum_score
        }
    }
```

### UI/UX Patterns

**Progress indication:**
- Always show progress for long operations (>2 seconds)
- Use specific messages ("Extracting audio..." not "Processing...")
- Show estimated time remaining when possible
- Allow cancellation of long operations

**Error handling:**
- Show user-friendly messages in UI
- Log technical details to console
- Offer actionable next steps ("Check your API key in settings")
- Don't show stack traces to users

**Example:**
```typescript
export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const analyze = async (videoPath: string) => {
    try {
      setStatus('extracting_audio');
      setProgress({ step: 'Extracting audio from video...', percent: 10 });
      
      const audio = await invoke<Uint8Array>('extract_audio', { videoPath });
      
      setStatus('detecting_scenes');
      setProgress({ step: 'Detecting scene changes...', percent: 30 });
      
      const scenes = await invoke<SceneBoundary[]>('detect_scenes', { videoPath });
      
      setStatus('uploading');
      setProgress({ step: 'Sending features to analysis server...', percent: 50 });
      
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ audio, scenes })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }
      
      setStatus('processing');
      setProgress({ step: 'Analyzing highlights...', percent: 75 });
      
      const result = await response.json();
      
      setStatus('complete');
      setProgress({ step: 'Complete!', percent: 100 });
      
      return result;
      
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Analysis failed: ${message}`);
      throw err;
    }
  };
  
  return { analyze, status, progress, error };
}
```

## Testing Guidelines

### Backend Tests (pytest)

**What to test:**
- Scoring functions with known inputs/outputs
- API endpoint validation (Pydantic models)
- Error handling paths
- Edge cases (empty audio, invalid timestamps, etc.)

**Example:**
```python
import pytest
import numpy as np
from app.core.scoring import calculate_audio_energy

def test_audio_energy_calculation():
    # Silent audio should return low score
    silent = np.zeros(480000)  # 10 seconds at 48kHz
    score = calculate_audio_energy(silent, 0, 10)
    assert score < 0.1
    
    # Loud audio should return high score
    loud = np.ones(480000) * 0.9
    score = calculate_audio_energy(loud, 0, 10)
    assert score > 0.8
    
    # Out of bounds should raise error
    with pytest.raises(ValueError):
        calculate_audio_energy(silent, 100, 10)  # Beyond array length
```

### Frontend Tests (Vitest + React Testing Library)

**What to test:**
- Component rendering with different props
- User interactions (clicks, form submissions)
- Custom hooks behavior
- Error states

**Example:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightList } from './HighlightList';

describe('HighlightList', () => {
  it('renders segments correctly', () => {
    const segments = [
      { id: '1', start: 10, end: 30, score: 0.8, label: 'chaos_spike', description: 'Test' }
    ];
    
    render(<HighlightList segments={segments} onSegmentSelect={() => {}} />);
    
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  it('calls onSegmentSelect when segment is clicked', () => {
    const mockSelect = vi.fn();
    const segments = [
      { id: '1', start: 10, end: 30, score: 0.8, label: 'chaos_spike', description: 'Test' }
    ];
    
    render(<HighlightList segments={segments} onSegmentSelect={mockSelect} />);
    
    fireEvent.click(screen.getByText('Test'));
    
    expect(mockSelect).toHaveBeenCalledWith(segments[0]);
  });
});
```

## Performance Considerations

### Desktop App
- **Don't load entire video into memory** - use streaming/chunked processing
- **Debounce UI updates** - don't re-render on every progress tick
- **Cancel in-progress operations** - when user selects new file
- **Cache metadata** - don't re-extract every time

### Backend
- **Stream large responses** - don't build entire response in memory
- **Use async I/O** - for file operations, API calls
- **Timeout long operations** - set reasonable limits (5 min max)
- **Rate limit API** - prevent abuse

## Common Pitfalls to Avoid

1. **Don't assume ffmpeg is installed** - check and provide helpful error
2. **Don't trust file extensions** - validate actual file format
3. **Don't ignore stderr** - ffmpeg outputs useful info there
4. **Don't expose API keys in frontend** - use environment variables
5. **Don't skip input validation** - especially for timestamps, file paths
6. **Don't use synchronous file I/O in Rust async contexts**
7. **Don't forget to cleanup temp files** - especially failed extractions

## Logging Strategy

**Python:**
```python
import logging

logger = logging.getLogger(__name__)

# In operations
logger.debug(f"Processing segment {start}-{end}")
logger.info(f"Analysis complete: found {len(segments)} highlights")
logger.warning(f"Low transcript confidence: {confidence}")
logger.error(f"Transcription failed: {error}", exc_info=True)
```

**TypeScript:**
```typescript
// Simple console wrapper with levels
const log = {
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
  info: (...args: any[]) => console.info('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

// Usage
log.info('Starting analysis for', videoPath);
log.error('Analysis failed:', error);
```

## File Organization

```
vaexcore-pulse/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── api/v1/         # API endpoints
│   │   ├── core/           # Business logic (scoring, etc)
│   │   ├── models/         # Pydantic schemas
│   │   ├── services/       # External services (Whisper, etc)
│   │   └── utils/          # Shared utilities
│   ├── tests/              # Pytest tests
│   └── requirements.txt
├── desktop/                # Tauri desktop app
│   ├── src-tauri/          # Rust backend
│   │   └── src/
│   │       ├── ffmpeg.rs   # FFmpeg integration
│   │       ├── api.rs      # Backend API client
│   │       └── main.rs
│   ├── src/                # React frontend
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom hooks
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helper functions
│   └── tests/              # Vitest tests
└── prototype/              # Phase 0 Python script
    └── analyze_vod.py
```

## When in Doubt

1. **Check the spec** - VAEXCORE_PULSE_SPEC.md has the answers
2. **Keep it simple** - Don't over-engineer for future features
3. **Make it work, then make it good** - Optimize after validation
4. **Log liberally** - You'll thank yourself when debugging
5. **Ask for tests** - "Write a test for this function"
6. **Prefer explicit over implicit** - Clear code > clever code

---

**Last updated:** 2024-11-16
**For project:** vaexcore pulse v0.1
