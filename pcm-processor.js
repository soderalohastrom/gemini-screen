class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.mode = options.processorOptions?.mode || 'output';
        this.targetSampleRate = 48000; // Changed to standard high-quality audio rate
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

        // Apply anti-aliasing filter before resampling
        const filteredData = this.applyAntiAliasingFilter(audioData);
        
        const ratio = fromSampleRate / toSampleRate;
        const newLength = Math.round(audioData.length / ratio);
        const result = new Float32Array(newLength);

        // Cubic interpolation for better quality
        for (let i = 0; i < newLength; i++) {
            const position = i * ratio;
            const index = Math.floor(position);
            const fraction = position - index;

            if (index > 0 && index < filteredData.length - 2) {
                // Cubic interpolation coefficients
                const a0 = filteredData[index - 1];
                const a1 = filteredData[index];
                const a2 = filteredData[index + 1];
                const a3 = filteredData[index + 2];

                // Cubic interpolation
                const mu2 = fraction * fraction;
                const mu3 = mu2 * fraction;

                result[i] = (a3 - a2 - a0 + a1) * mu3 +
                           (2.0 * a0 - 5.0 * a1 + 4.0 * a2 - a3) * mu2 +
                           (a2 - a0) * fraction +
                           2.0 * a1;
                result[i] *= 0.5; // Scale to prevent clipping
            } else {
                // Fall back to linear interpolation at edges
                result[i] = filteredData[index];
            }
        }

        return result;
    }

    processInputBuffer() {
        if (this.inputBuffer.length > 0) {
            let dataToSend = this.inputBuffer;
            if (sampleRate !== this.targetSampleRate) {
                dataToSend = this.resampleAudio(this.inputBuffer, sampleRate, this.targetSampleRate);
            }

            // Apply dynamic range compression
            dataToSend = this.applyCompression(dataToSend);

            const buffer = new ArrayBuffer(dataToSend.length * 2);
            const view = new DataView(buffer);
            
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

    applyCompression(data) {
        const threshold = 0.5;
        const ratio = 4;
        return data.map(sample => {
            if (Math.abs(sample) > threshold) {
                const excess = Math.abs(sample) - threshold;
                const compressed = threshold + excess / ratio;
                return Math.sign(sample) * compressed;
            }
            return sample;
        });
    }

    handleOutputData(newData) {
        let processedData = newData;
        if (sampleRate !== this.targetSampleRate) {
            processedData = this.resampleAudio(newData, this.targetSampleRate, sampleRate);
        }

        // Apply compression for consistent volume
        processedData = this.applyCompression(processedData);

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
                    const fadeLength = Math.min(256, outputChannel.length);
                    const processedBuffer = this.applyCrossFade(
                        this.outputBuffer.slice(0, outputChannel.length),
                        fadeLength
                    );
                    
                    outputChannel.set(processedBuffer);
                    this.outputBuffer = this.outputBuffer.slice(outputChannel.length);
                } else {
                    outputChannel.fill(0);
                    if (this.outputBuffer.length > 0) {
                        const fadeLength = Math.min(256, this.outputBuffer.length);
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