class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.mode = options.processorOptions?.mode || 'output';
        this.buffer = new Float32Array();
        this.inputBuffer = new Float32Array();
        this.inputSampleCount = 0;
        this.MAX_BUFFER_SIZE = 16000;
        this.playbackRate = 1.5; // Match ratio between Gemini output (24kHz) and input (16kHz)

        this.port.onmessage = (e) => {
            if (this.mode === 'input' && e.data.type === 'get_buffer') {
                this.processInputBuffer();
            } else if (this.mode === 'output' && e.data instanceof Float32Array) {
                // For output mode, just buffer the data
                const newData = e.data;
                const newBuffer = new Float32Array(this.buffer.length + newData.length);
                newBuffer.set(this.buffer);
                newBuffer.set(newData, this.buffer.length);
                this.buffer = newBuffer;
            }
        };
    }

    processInputBuffer() {
        if (this.inputBuffer.length > 0) {
            const buffer = new ArrayBuffer(this.inputBuffer.length * 2);
            const view = new DataView(buffer);
            
            this.inputBuffer.forEach((value, index) => {
                const clampedValue = Math.max(-1, Math.min(1, value));
                view.setInt16(index * 2, clampedValue * 0x7fff, true);
            });
            
            this.port.postMessage({
                type: 'audio_data',
                buffer: buffer
            }, [buffer]);
            
            this.inputBuffer = new Float32Array();
            this.inputSampleCount = 0;
        }
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
                
                // Calculate how many samples we need based on playback rate
                const samplesNeeded = Math.ceil(outputChannel.length * this.playbackRate);
                
                if (this.buffer.length >= samplesNeeded) {
                    // Read more samples from buffer but output fewer to increase speed
                    for (let i = 0; i < outputChannel.length; i++) {
                        const readIndex = Math.floor(i * this.playbackRate);
                        outputChannel[i] = this.buffer[readIndex];
                    }
                    this.buffer = this.buffer.slice(samplesNeeded);
                } else if (this.buffer.length > 0) {
                    // Handle remaining buffer
                    const remainingSamples = Math.floor(this.buffer.length / this.playbackRate);
                    for (let i = 0; i < remainingSamples; i++) {
                        const readIndex = Math.floor(i * this.playbackRate);
                        outputChannel[i] = this.buffer[readIndex];
                    }
                    outputChannel.fill(0, remainingSamples);
                    this.buffer = new Float32Array();
                } else {
                    outputChannel.fill(0);
                }
            }
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);