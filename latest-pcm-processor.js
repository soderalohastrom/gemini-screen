class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.mode = options.processorOptions?.mode || 'output';
        this.targetSampleRate = 16000; // Match input sample rate
        this.outputBuffer = new Float32Array();
        this.inputBuffer = new Float32Array();
        this.inputSampleCount = 0;
        this.BUFFER_SIZE = 1024;
        this.MAX_BUFFER_SIZE = 16000;
        this.lastSampleRate = null;
        this.currentSampleRate = null;
        
        // Adjusted filter coefficients to allow more high frequencies
        this.filterCoeff = new Float32Array([0.1, 0.8, 0.1]);
        
        // High-frequency boost filter (subtle boost around 2-3kHz)
        this.highBoostFilter = {
            prevInput: 0,
            prevOutput: 0,
            coefficient: 0.2  // Adjust for more/less boost
        };
        
        this.port.onmessage = (e) => {
            if (this.mode === 'input' && e.data.type === 'get_buffer') {
                this.processInputBuffer();
            } else if (this.mode === 'output' && e.data instanceof Float32Array) {
                this.handleOutputData(e.data);
            } else if (e.data.type === 'set_sample_rate') {
                this.handleSampleRateChange(e.data.sampleRate);
            }
        };

        this.currentSampleRate = sampleRate;
        console.log(`Initial system sample rate: ${this.currentSampleRate}Hz`);
    }

    applyHighFrequencyBoost(data) {
        const result = new Float32Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            // Simple high-shelf filter
            const input = data[i];
            const highFreq = input - this.highBoostFilter.prevInput;
            this.highBoostFilter.prevInput = input;
            
            const boosted = input + (highFreq * this.highBoostFilter.coefficient);
            result[i] = boosted;
        }
        
        return result;
    }

    resampleAudio(audioData, fromSampleRate, toSampleRate) {
        if (fromSampleRate === toSampleRate) {
            return audioData;
        }

        console.log(`Resampling from ${fromSampleRate}Hz to ${toSampleRate}Hz`);

        const shouldFilter = fromSampleRate > toSampleRate;
        const filteredData = shouldFilter ? this.applyAntiAliasingFilter(audioData) : audioData;
        
        const ratio = fromSampleRate / toSampleRate;
        const newLength = Math.round(audioData.length / ratio);
        const result = new Float32Array(newLength);

        // Improved interpolation using 4-point cubic
        for (let i = 0; i < newLength; i++) {
            const position = i * ratio;
            const index = Math.floor(position);
            const fraction = position - index;

            // Get four points for cubic interpolation
            const p0 = filteredData[Math.max(0, index - 1)] || 0;
            const p1 = filteredData[index] || 0;
            const p2 = filteredData[Math.min(filteredData.length - 1, index + 1)] || p1;
            const p3 = filteredData[Math.min(filteredData.length - 1, index + 2)] || p2;

            // Cubic interpolation
            const a0 = p3 - p2 - p0 + p1;
            const a1 = p0 - p1 - a0;
            const a2 = p2 - p0;
            const a3 = p1;

            const t = fraction;
            result[i] = a0 * t * t * t + a1 * t * t + a2 * t + a3;
        }

        return result;
    }

    handleOutputData(newData) {
        let processedData = newData;
        
        if (this.currentSampleRate !== this.targetSampleRate) {
            processedData = this.resampleAudio(processedData, this.targetSampleRate, this.currentSampleRate);
        }

        // Apply high-frequency boost
        processedData = this.applyHighFrequencyBoost(processedData);

        // Normalize and increase gain while preventing clipping
        const maxAmp = Math.max(...processedData.map(Math.abs));
        if (maxAmp > 0) {
            const targetGain = 0.9; // Increased from previous 0.95
            const scalar = Math.min(targetGain / maxAmp, 2.0); // Allow up to 2x boost
            processedData = processedData.map(s => s * scalar);
        }

        // Monitor levels
        const rms = Math.sqrt(processedData.reduce((sum, x) => sum + x * x, 0) / processedData.length);
        console.log(`Output audio levels - Peak: ${maxAmp.toFixed(2)}, RMS: ${rms.toFixed(2)}`);

        const newBuffer = new Float32Array(this.outputBuffer.length + processedData.length);
        newBuffer.set(this.outputBuffer);
        newBuffer.set(processedData, this.outputBuffer.length);
        
        if (newBuffer.length > this.MAX_BUFFER_SIZE) {
            this.outputBuffer = newBuffer.slice(-this.MAX_BUFFER_SIZE);
        } else {
            this.outputBuffer = newBuffer;
        }
    }

    // ... rest of the methods remain the same ...
}

registerProcessor('pcm-processor', PCMProcessor);