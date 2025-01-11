class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.mode = options.processorOptions?.mode || 'output';
        this.targetSampleRate = 48000; // Standard high-quality audio rate
        this.outputBuffer = new Float32Array();
        this.inputBuffer = new Float32Array();
        this.inputSampleCount = 0;
        this.BUFFER_SIZE = 1024; // Optimized for lower latency
        this.MAX_BUFFER_SIZE = 48000; // 1 second of audio at 48kHz
        this.lastSampleRate = null;
        this.smoothingFactor = 0.15; // For smooth transitions
        
        // Anti-aliasing filter coefficients
        this.filterCoeff = new Float32Array([0.23, 0.54, 0.23]); // Simple low-pass filter
        
        this.port.onmessage = (e) => {
            if (this.mode === 'input' && e.data.type === 'get_buffer') {
                this.processInputBuffer();
            } else if (this.mode === 'output' && e.data instanceof Float32Array) {
                this.handleOutputData(e.data);
            } else if (e.data.type === 'set_sample_rate') {
                this.handleSampleRateChange(e.data.sampleRate);
            }
        };
    }

    handleSampleRateChange(newSampleRate) {
        if (this.lastSampleRate !== newSampleRate) {
            console.log(`Sample rate changed from ${this.lastSampleRate} to ${newSampleRate}`);
            this.lastSampleRate = newSampleRate;
        }
    }

    applyAntiAliasingFilter(data) {
        const filtered = new Float32Array(data.length);
        for (let i = 1; i < data.length - 1; i++) {
            filtered[i] = this.filterCoeff[0] * data[i-1] + 
                         this.filterCoeff[1] * data[i] + 
                         this.filterCoeff[2] * data[i+1];
        }
        // Handle edges
        filtered[0] = data[0];
        filtered[data.length - 1] = data[data.length - 1];
        return filtered;
    }

    resampleAudio(audioData, fromSampleRate, toSampleRate) {
        if (fromSampleRate === toSampleRate) {
            return audioData;
        }

        // Apply anti-aliasing filter before resampling if downsampling
        const shouldFilter = fromSampleRate > toSampleRate;
        const filteredData = shouldFilter ? this.applyAntiAliasingFilter(audioData) : audioData;
        
        const ratio = fromSampleRate / toSampleRate;
        const newLength = Math.round(audioData.length / ratio);
        const result = new Float32Array(newLength);

        // Linear interpolation for better performance and less artifacts
        for (let i = 0; i < newLength; i++) {
            const position = i * ratio;
            const index = Math.floor(position);
            const fraction = position - index;

            const current = filteredData[index] || 0;
            const next = filteredData[index + 1] || current;

            result[i] = current + fraction * (next - current);
        }

        return result;
    }

    processInputBuffer() {
        if (this.inputBuffer.length > 0) {
            let dataToSend = this.inputBuffer;
            
            // Convert from input sample rate to target sample rate
            if (sampleRate !== this.targetSampleRate) {
                dataToSend = this.resampleAudio(dataToSend, sampleRate, this.targetSampleRate);
            }

            const buffer = new ArrayBuffer(dataToSend.length * 2);
            const view = new DataView(buffer);
            
            // Simple clipping prevention
            dataToSend.forEach((value, index) => {
                const clampedValue = Math.max(-1, Math.min(1, value));
                view.setInt16(index * 2, clampedValue * 0x7fff, true);
            });
            
            this.port.postMessage({
                type: 'audio_data',
                buffer: buffer,
                sampleRate: this.targetSampleRate
            }, [buffer]);
            
            this.inputBuffer = new Float32Array();
            this.inputSampleCount = 0;
        }
    }

    handleOutputData(newData) {
        let processedData = newData;
        
        // Convert from target sample rate to output sample rate
        if (sampleRate !== this.targetSampleRate) {
            console.log(`Converting from ${this.targetSampleRate}Hz to ${sampleRate}Hz`);
            processedData = this.resampleAudio(processedData, sampleRate, this.targetSampleRate);
        }

        // Simple normalization to prevent clipping
        const maxAmp = Math.max(...processedData.map(Math.abs));
        if (maxAmp > 1) {
            processedData = processedData.map(s => s / maxAmp);
        }

        const newBuffer = new Float32Array(this.outputBuffer.length + processedData.length);
        newBuffer.set(this.outputBuffer);
        newBuffer.set(processedData, this.outputBuffer.length);
        
        if (newBuffer.length > this.MAX_BUFFER_SIZE) {
            this.outputBuffer = newBuffer.slice(-this.MAX_BUFFER_SIZE);
        } else {
            this.outputBuffer = newBuffer;
        }
    }

    applyCrossFade(buffer, fadeLength) {
        const fadedBuffer = new Float32Array(buffer.length);
        fadedBuffer.set(buffer);
        
        // Apply fade in
        for (let i = 0; i < fadeLength; i++) {
            const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeLength));
            fadedBuffer[i] *= factor;
        }
        
        // Apply fade out
        for (let i = 0; i < fadeLength; i++) {
            const factor = 0.5 * (1 + Math.cos((Math.PI * i) / fadeLength));
            fadedBuffer[buffer.length - fadeLength + i] *= factor;
        }
        
        return fadedBuffer;
    }

    process(inputs, outputs, parameters) {
        if (this.mode === 'input') {
            const input = inputs[0];
            if (input && input[0]) {
                const inputData = input[0];
                
                if (this.inputSampleCount < this.MAX_BUFFER_SIZE) {
                    const newInputBuffer = new Float32Array(this.inputBuffer.length + inputData.length);
                    newInputBuffer.set(this.inputBuffer);
                    newInputBuffer.set(inputData, this.inputBuffer.length);
                    this.inputBuffer = newInputBuffer;
                    this.inputSampleCount += inputData.length;
                }
            }
        } else if (this.mode === 'output') {
            const output = outputs[0];
            if (output && output[0]) {
                const outputChannel = output[0];
                
                if (this.outputBuffer.length >= outputChannel.length) {
                    const fadeLength = Math.min(128, outputChannel.length / 8);
                    const processedBuffer = this.applyCrossFade(
                        this.outputBuffer.slice(0, outputChannel.length),
                        fadeLength
                    );
                    
                    outputChannel.set(processedBuffer);
                    this.outputBuffer = this.outputBuffer.slice(outputChannel.length);
                } else {
                    outputChannel.fill(0);
                    if (this.outputBuffer.length > 0) {
                        const fadeLength = Math.min(128, this.outputBuffer.length / 8);
                        const processedBuffer = this.applyCrossFade(
                            this.outputBuffer,
                            fadeLength
                        );
                        outputChannel.set(processedBuffer);
                        this.outputBuffer = new Float32Array();
                    }
                }
            }
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);