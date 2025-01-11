class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.outputBuffer = new Float32Array();
        this.inputBuffer = new Float32Array();
        this.inputSampleCount = 0;
        const BUFFER_SIZE = 4096; // Match the previous ScriptProcessor buffer size

        this.port.onmessage = (e) => {
            if (e.data.type === 'get_buffer') {
                // Send accumulated input buffer
                if (this.inputBuffer.length > 0) {
                    const buffer = new ArrayBuffer(this.inputBuffer.length * 2);
                    const view = new DataView(buffer);
                    this.inputBuffer.forEach((value, index) => {
                        view.setInt16(index * 2, value * 0x7fff, true);
                    });
                    this.port.postMessage({
                        type: 'audio_data',
                        buffer: buffer
                    });
                    this.inputBuffer = new Float32Array();
                    this.inputSampleCount = 0;
                }
            } else {
                // Handle output audio data
                const newData = e.data;
                const newBuffer = new Float32Array(this.outputBuffer.length + newData.length);
                newBuffer.set(this.outputBuffer);
                newBuffer.set(newData, this.outputBuffer.length);
                this.outputBuffer = newBuffer;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        // Handle input (microphone)
        if (input && input[0]) {
            const inputData = input[0];
            const newInputBuffer = new Float32Array(this.inputBuffer.length + inputData.length);
            newInputBuffer.set(this.inputBuffer);
            newInputBuffer.set(inputData, this.inputBuffer.length);
            this.inputBuffer = newInputBuffer;
            this.inputSampleCount += inputData.length;
        }

        // Handle output (playback)
        if (output && output[0]) {
            const outputChannel = output[0];
            if (this.outputBuffer.length >= outputChannel.length) {
                outputChannel.set(this.outputBuffer.slice(0, outputChannel.length));
                this.outputBuffer = this.outputBuffer.slice(outputChannel.length);
            }
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);