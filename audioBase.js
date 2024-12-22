import crypto from 'crypto';
import { Buffer } from 'buffer';
function createDummyWavBase64(sizeKB = 100) {
  /**
   * Creates a dummy base64 representation of a WAV file in JavaScript.
   * @param {number} sizeKB The approximate size of the dummy data in kilobytes.
   * @returns {string|null} A base64 encoded string or null on error.
   */

  // Minimal WAV header (simplified).
  const wavHeader = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x00,
    0x00,
    0x00,
    0x00, // File size (placeholder)
    0x57,
    0x41,
    0x56,
    0x45, // "WAVE"
    0x66,
    0x6d,
    0x74,
    0x20, // "fmt "
    0x10,
    0x00,
    0x00,
    0x00, // Chunk size
    0x01,
    0x00, // Audio format (PCM)
    0x01,
    0x00, // Number of channels (mono)
    0x80,
    0x3e,
    0x00,
    0x00, // Sample rate (16000 Hz)
    0x00,
    0x00,
    0x00,
    0x00, // Byte rate
    0x00,
    0x00, // Block align
    0x00,
    0x00, // Bits per sample
    0x64,
    0x61,
    0x74,
    0x61, // "data"
    0x00,
    0x00,
    0x00,
    0x00, // Data size (placeholder)
  ]);

  const headerLength = wavHeader.length;
  const dataSize = sizeKB * 1024 - headerLength;

  if (dataSize < 0) {
    console.error('Requested size is too small to include a header.');
    return null;
  }

  const randomData = new Uint8Array(dataSize);
  // Use crypto.getRandomValues for better randomness in browsers.
  if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
    crypto.getRandomValues(randomData);
  } else if (typeof require === 'function') {
    //for node.js

    crypto.randomFillSync(randomData);
  } else {
    // Fallback if crypto is not available (less secure).
    for (let i = 0; i < dataSize; i++) {
      randomData[i] = Math.floor(Math.random() * 256);
    }
    console.warn('crypto API not available. Using Math.random() for less secure random data.');
  }

  const wavData = new Uint8Array(headerLength + dataSize);
  wavData.set(wavHeader);
  wavData.set(randomData, headerLength);

  // Base64 encoding (using btoa in browsers or Buffer in Node.js).
  let base64Encoded;
  if (typeof btoa === 'function') {
    base64Encoded = btoa(String.fromCharCode.apply(null, wavData));
  } else if (typeof Buffer !== 'undefined') {
    base64Encoded = Buffer.from(wavData).toString('base64');
  } else {
    console.error('Base64 encoding not available in this environment.');
    return null;
  }

  return base64Encoded;
}

// Example usage:
const dummyBase64 = createDummyWavBase64(50);
if (dummyBase64) {
  console.log(`Dummy Base64 (first 100 chars): ${dummyBase64.substring(0, 100)}...`);
  // For saving in a browser:
  // const link = document.createElement('a');
  // link.href = 'data:text/plain;base64,' + dummyBase64;
  // link.download = 'dummy_audio.txt';
  // link.click();
}

const tinyBase64 = createDummyWavBase64(1);
if (tinyBase64) {
  console.log(`\nTiny Dummy Base64: ${tinyBase64}`);
}
