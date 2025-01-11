class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.mode = options.processorOptions?.mode || 'output';
        this.targetSampleRate = 16000;
        this.outputBuffer = new Float32Array();
        this.inputBuffer = new Float32Array();
        this.inputSampleCount = 0;
        this.BUFFER_SIZE = 2048; // Reduced for lower latency
        this.MAX_BUFFER_SIZE = 16000; // 1 second of audio at 16kHz
        this.lastSampleRate = null;

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

    processInputBuffer() {
        if (this.inputBuffer.length > 0) {
            // Resample if necessary
            let dataToSend = this.inputBuffer;
            if (sampleRate !== this.targetSampleRate) {
                dataToSend = this.resampleAudio(this.inputBuffer, sampleRate, this.targetSampleRate);
            }

            const buffer = new ArrayBuffer(dataToSend.length * 2);
            const view = new DataView(buffer);
            
            // Convert to 16-bit PCM with proper scaling
            dataToSend.forEach((value, index) => {
                // Clamp values to prevent distortion
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
        // Resample output data if necessary
        let processedData = newData;
        if (sampleRate !== this.targetSampleRate) {
            processedData = this.resampleAudio(newData, this.targetSampleRate, sampleRate);
        }

        const newBuffer = new Float32Array(this.outputBuffer.length + processedData.length);
        newBuffer.set(this.outputBuffer);
        newBuffer.set(processedData, this.outputBuffer.length);
        
        // Implement circular buffer to prevent excessive growth
        if (newBuffer.length > this.MAX_BUFFER_SIZE) {
            this.outputBuffer = newBuffer.slice(-this.MAX_BUFFER_SIZE);
        } else {
            this.outputBuffer = newBuffer;
        }
    }

    resampleAudio(audioData, fromSampleRate, toSampleRate) {
        if (fromSampleRate === toSampleRate) {
            return audioData;
        }

        const ratio = fromSampleRate / toSampleRate;
        const newLength = Math.round(audioData.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const position = i * ratio;
            const index = Math.floor(position);
            const fraction = position - index;

            if (index + 1 < audioData.length) {
                // Linear interpolation
                result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
            } else {
                result[i] = audioData[index];
            }
        }

        return result;
    }

    process(inputs, outputs, parameters) {
        if (this.mode === 'input') {
            const input = inputs[0];
            if (input && input[0]) {
                const inputData = input[0];
                
                // Only accumulate if we haven't exceeded max buffer size
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
                    // Apply smoothing to prevent clicks and pops
                    const fadeLength = Math.min(128, outputChannel.length);
                    for (let i = 0; i < outputChannel.length; i++) {
                        const value = this.outputBuffer[i];
                        if (i < fadeLength) {
                            // Fade in
                            outputChannel[i] = value * (i / fadeLength);
                        } else if (i >= outputChannel.length - fadeLength) {
                            // Fade out
                            outputChannel[i] = value * ((outputChannel.length - i) / fadeLength);
                        } else {
                            outputChannel[i] = value;
                        }
                    }
                    this.outputBuffer = this.outputBuffer.slice(outputChannel.length);
                } else {
                    // If we don't have enough data, output silence with fade out
                    const fadeLength = Math.min(128, this.outputBuffer.length);
                    outputChannel.fill(0);
                    for (let i = 0; i < this.outputBuffer.length; i++) {
                        if (i < this.outputBuffer.length - fadeLength) {
                            outputChannel[i] = this.outputBuffer[i];
                        } else {
                            // Fade out remaining samples
                            const fadeOut = (this.outputBuffer.length - i) / fadeLength;
                            outputChannel[i] = this.outputBuffer[i] * fadeOut;
                        }
                    }
                    this.outputBuffer = new Float32Array();
                }
            }
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);