# Audio Processing in Gemini Screen Share

## Overview
This document details the audio processing implementation for the Gemini Screen Share application, specifically focusing on handling the voice output from Gemini's multimodal API.

## Key Specifications
- Input audio format: Raw 16-bit PCM at 16kHz (little-endian)
- Output audio format: Raw 16-bit PCM at 24kHz (little-endian)
- Browser audio context: Typically 48kHz
- Optimal playback rate: 1.5 (ratio of 24kHz/16kHz)

## Solution Evolution
We went through several iterations to find the optimal audio processing approach:

1. Initial attempts with complex processing:
   - Sample rate conversion
   - Anti-aliasing filters
   - High-frequency boost
   - Dynamic range compression
   → Result: Garbled, "munchkin-like" voice

2. Simplified approach with rate adjustment:
   - Removed all filters and processing
   - Tried various playback rates:
     - 2.0 (too fast)
     - 0.5 (too slow)
     - 1.0 (too slow)
   → Result: Clear but incorrect speed

3. Final solution:
   - Used ratio between Gemini's input/output rates
   - Set playback rate to 1.5
   - Simple buffer management
   - Linear interpolation
   → Result: Perfect natural voice

## Implementation Details

### AudioWorklet Processor
```javascript
class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.mode = options.processorOptions?.mode || 'output';
        this.buffer = new Float32Array();
        this.playbackRate = 1.5; // Match ratio between Gemini output (24kHz) and input (16kHz)
        
        this.port.onmessage = (e) => {
            if (this.mode === 'output' && e.data instanceof Float32Array) {
                const newData = e.data;
                const newBuffer = new Float32Array(this.buffer.length + newData.length);
                newBuffer.set(this.buffer);
                newBuffer.set(newData, this.buffer.length);
                this.buffer = newBuffer;
            }
        };
    }
}
```

### Sample Processing
```javascript
// Output processing with correct playback rate
if (this.buffer.length >= samplesNeeded) {
    // Read more samples from buffer but output fewer to adjust speed
    for (let i = 0; i < outputChannel.length; i++) {
        const readIndex = Math.floor(i * this.playbackRate);
        outputChannel[i] = this.buffer[readIndex];
    }
    this.buffer = this.buffer.slice(samplesNeeded);
}
```

### Audio Context Initialization
```javascript
// Initialize audio context with proper configuration
const audioContext = new AudioContext({
    sampleRate: 48000,  // Browser's native rate
    latencyHint: 'interactive'
});

// Create and connect the audio worklet
await audioContext.audioWorklet.addModule('pcm-processor.js');
const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
    processorOptions: {
        mode: 'output'
    }
});
workletNode.connect(audioContext.destination);
```

## Key Learnings

1. **Sample Rate Understanding**
   - Gemini's output is 24kHz
   - Browser audio typically runs at 48kHz
   - Matching the ratio between input/output rates is crucial

2. **Simplicity is Key**
   - Complex audio processing often introduces artifacts
   - Simple buffer management with correct playback rate works best
   - Let the browser handle native sample rate conversion

3. **Buffer Management**
   - Keep buffer size reasonable (we use 16000 samples)
   - Process in small chunks for low latency
   - Use linear interpolation for smooth playback

## Troubleshooting

If audio playback issues occur, check:
1. Audio context sample rate (should be 48kHz)
2. Playback rate setting (should be 1.5)
3. Browser console for sample rate mismatch errors
4. Buffer underrun/overrun messages

## Future Improvements

Potential areas for enhancement:
1. Dynamic buffer size adjustment based on system performance
2. Optional high-quality resampling for systems that support it
3. Voice activity detection for better stream management
4. Audio quality metrics logging

## References

- [Gemini Multimodal API Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet Documentation](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)