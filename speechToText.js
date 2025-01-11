import path from "node:path";
import util from "node:util";
import { exec as execCallback } from "node:child_process";
import fs from "node:fs/promises";
const exec = util.promisify(execCallback);
import os from "node:os";

const TEMP_DIR = path.join(os.tmpdir(), "audio-output");

// Create temp directory if it doesn't exist
(async () => {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
})();

export async function speakText(text) {
  try {
    const timestamp = Date.now();
    const tempAiff = path.join(TEMP_DIR, `speech_${timestamp}.aiff`);
    const outputPath = path.join(TEMP_DIR, `speech_${timestamp}.wav`);

    // Generate speech as AIFF
    await exec(`say -o "${tempAiff}" "${text}"`);

    // Convert AIFF to WAV
    await exec(
      `afconvert "${tempAiff}" "${outputPath}" -f WAVE -d LEI16@44100 -c 1`
    );

    const audioBuffer = await fs.readFile(outputPath);
    const base64Audio = audioBuffer.toString("base64");

    // Clean up temp files
    await fs.unlink(tempAiff);
    await fs.unlink(outputPath);

    return base64Audio;
  } catch (error) {
    console.error("Speech synthesis error:", error);
    throw new Error("Failed to synthesize speech");
  }
}
