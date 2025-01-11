# Gemini Screen Share - Working Code Snapshot with Audio Issues

You are able to directly SSH into my Hostinger VPS using:

```bash
ssh root@147.93.45.244
ssh root@147.93.45.244 "journalctl -u gemini-screen -f"
ssh root@147.93.45.244 "tail -f /var/log/nginx/gemini-screen.error.log"
```

The directory we are working in that matches our local codebase is:
`/home/scott/gemini-screen`

You can write files locally then with git and commit to https://github.com/soderalohastrom/gemini-screen 

## Current State

1. Application successfully loads and establishes WebSocket connections
2. Screen sharing functionality is working through HTTPS
3. Audio input/output is functional but has quality issues:
   - Audio output is squeaky and high-pitched
   - Possible sample rate mismatch or audio processing issues

## Root Causes of Audio Issues

1. **Sample Rate Handling**: 
   - The application attempts to use a fixed 16kHz sample rate
   - When device doesn't support exact rate, fallback handling may not properly resample
   - Current code in `index.html` tries to match audio context sample rate with input stream

2. **Audio Processing Pipeline**:
   - Audio worklet processor may not properly handle sample rate conversion
   - Potential buffer size mismatches between input and output
   - PCM encoding/decoding might not preserve audio fidelity

## Next Steps

1. **Audio Sample Rate Handling**:
   - Add proper sample rate conversion in pcm-processor.js
   - Implement resampling when device sample rate doesn't match target
   - Add logging to track actual sample rates through the pipeline

2. **Audio Buffer Management**:
   - Review and optimize buffer sizes for audio processing
   - Ensure consistent buffer handling between input and output
   - Add checks for buffer underruns/overruns

3. **PCM Processing Improvements**:
   - Validate PCM encoding/decoding process
   - Add error handling for malformed audio data
   - Implement proper audio format validation

4. **Testing and Monitoring**:
   - Add audio quality metrics logging
   - Test with various input devices and sample rates
   - Monitor audio pipeline performance

## Files to Focus On

1. `pcm-processor.js`: Audio worklet implementation
   - Review sample rate handling
   - Check buffer processing logic
   - Validate PCM conversion

2. `index.html`: Client-side audio setup
   - Improve sample rate negotiation
   - Add better error handling
   - Implement proper audio context management

3. `main.py`: Server-side audio handling
   - Verify audio chunk processing
   - Add validation for audio data
   - Improve error reporting

## Implementation Plan

1. Phase 1 - Diagnostics
   - Add comprehensive logging throughout audio pipeline
   - Capture actual sample rates and buffer sizes
   - Monitor audio quality metrics

2. Phase 2 - Core Fixes
   - Implement proper sample rate conversion
   - Fix buffer size handling
   - Improve PCM processing

3. Phase 3 - Quality Improvements
   - Add audio quality checks
   - Implement adaptive buffer sizing
   - Optimize performance

4. Phase 4 - Testing
   - Test with various devices
   - Validate audio quality
   - Performance testing