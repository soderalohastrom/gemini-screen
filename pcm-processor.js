class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.mode = options.processorOptions?.mode || 'output';
        this.outputBuffer = new Float32Array();
        this.inputBuffer = new Float32Array();
        this.inputSampleCount = 0;
        this.BUFFER_SIZE = 4096; // Match the previous ScriptProcessor buffer size
        this.MAX_BUFFER_SIZE = 16000; // 1 second of audio at 16kHz

        this.port.onmessage = (e) => {
            if (this.mode === 'input' && e.data.type === 'get_buffer') {
                // Send accumulated input buffer
                if (this.inputBuffer.length > 0) {
                    const buffer = new ArrayBuffer(this.inputBuffer.length * 2);
                    const view = new DataView(buffer);
                    this.inputBuffer.forEach((value, index) => {
                        view.setInt16(index * 2, value * 0x7fff, true);
                    });

                    // Convert to base64 directly in the worklet
                    const base64 = this.arrayBufferToBase64(buffer);
                    
                    this.port.postMessage({
                        type: 'audio_data',
                        base64: base64
                    });
                    
                    this.inputBuffer = new Float32Array();
                    this.inputSampleCount = 0;
                }
            } else if (this.mode === 'output' && e.data instanceof Float32Array) {
                // Handle output audio data
                const newData = e.data;
                const newBuffer = new Float32Array(this.outputBuffer.length + newData.length);
                newBuffer.set(this.outputBuffer);
                newBuffer.set(newData, this.outputBuffer.length);
                this.outputBuffer = newBuffer;
            }
        };
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    process(inputs, outputs, parameters) {
        if (this.mode === 'input') {
            // Handle input (microphone)
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
            // Handle output (playback)
            const output = outputs[0];
            if (output && output[0]) {
                const outputChannel = output[0];
                if (this.outputBuffer.length >= outputChannel.length) {
                    outputChannel.set(this.outputBuffer.slice(0, outputChannel.length));
                    this.outputBuffer = this.outputBuffer.slice(outputChannel.length);
                } else {
                    // If we don't have enough data, output silence
                    outputChannel.fill(0);
                }
            }
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);