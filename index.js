/* eslint-disable no-unused-vars */
import crypto from "crypto";

import fastifyWebsocket from "@fastify/websocket";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fs from "fs/promises";
import fsWrite from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { speakText } from "./utils/speechToText.js";
import { randomPhrase } from "./utils/randomPhrase.js";

const fastify = Fastify({
  bodyLimit: 100 * 1024 * 1024,
});
const multipartUploads = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "uploads");
(async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR);
  }
})();

fastify.register(cors, {
  // allowedHeaders: [
  // 'Content-Type',
  // 'Authorization',
  // 'X-Requested-With',
  // 'multipart/form-data',
  // 'x-CSRFToken',
  // ],
  credentials: true,
  exposedHeaders: ["etag"],
  origin: ["http://localhost:5173"],
  // methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
fastify.addContentTypeParser(
  ["application/octet-stream", "application/pdf"],
  { parseAs: "buffer" },
  function (req, body, done) {
    done(null, body);
  }
);

fastify.register(fastifyWebsocket);

fastify.get("/api/get-csrf-token/", (_req, res) => {
  return { csrfToken: crypto.randomBytes(8).toString("hex") };
});

fastify.register(async function (fastify) {
  fastify.get(
    "/ws/voice/:interviewId/:candidateId/",
    { websocket: true },
    (ws /* WebSocket */, req /* FastifyRequest */, params) => {
      console.log("url");

      const interviewId = req.params?.interviewId;
      const candidateId = req.params?.candidateId;

      ws.on("message", async (text) => {
        // message.toString() === 'hi from client'
        console.log("passing message to client", text.toString());

        const sampleText = randomPhrase();
        const base64Audio = await speakText(sampleText);
        ws.send(
          JSON.stringify({
            type: "ai_response",
            audio_url: base64Audio,
            text: sampleText,
          })
        );
      });
      ws.on("close", () => {
        console.log("Client disconnected");
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    }
  );
});

fastify.get("/api", async (req, reply) => {
  return { message: "Hello, Fastify!" };
});

fastify.post("/api/init-multipart-upload/", async (req, res) => {
  try {
    console.log("init multipart upload");
    const { fileName, fileType, interviewId, candidate_id } = req.body;
    // Generate unique upload ID (simulating S3's upload ID)
    console.log("candidate_id:", candidate_id);
    const uploadId = crypto.randomUUID().slice(0, 8);
    const key = `${interviewId}/${candidate_id}/${uploadId}`;

    // Initialize upload state
    multipartUploads.set(uploadId, {
      filename: fileName,
      parts: new Map(),
      startTime: Date.now(),
      status: "in-progress",
      key,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { uploadId, key, message: "Multipart upload initialized" };
  } catch (error) {
    console.error("Initialize upload error:", error);
    res.status(500).send({
      error: "Failed to initialize upload",
    });
  }
});

fastify.post("/api/get-upload-part-url/", async (req, res) => {
  try {
    const { uploadId, partNumber } = req.body;
    console.log("get upload part url");
    if (!multipartUploads.has(uploadId)) {
      return res.status(404).send({
        error: "Upload ID not found",
      });
    }

    // Generate mock presigned URL
    const presignedUrl = `http://localhost:3000/api/upload-part/${uploadId}/${partNumber}`;

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));
    // console.log("upload url:", presignedUrl);
    return { url: presignedUrl };
  } catch (error) {
    console.error("Get upload URL error:", error);
    res.status(500).send({
      error: "Failed to generate upload URL",
    });
  }
});

// Handles actual part upload
fastify.put("/api/upload-part/:uploadId/:partNumber", async (req, res) => {
  try {
    const { uploadId, partNumber } = req.params;
    const uploadState = multipartUploads.get(uploadId);

    if (!uploadState) {
      return res.status(404).send({
        error: "Upload ID not found",
      });
    }

    const partFilePath = path.join(UPLOAD_DIR, `${uploadId}-part${partNumber}`);

    // Stream the part data to file
    await fs.writeFile(partFilePath, req.body);

    // Generate ETag (in S3 this would be MD5 of the part)
    const partData = await fs.readFile(partFilePath);
    const etag = crypto.createHash("md5").update(partData).digest("hex");

    // Store part information
    uploadState.parts.set(parseInt(partNumber), {
      etag,
      size: partData.length,
      path: partFilePath,
    });

    // Simulate upload delay based on file size
    const delay = Math.min(partData.length / 10000, 2000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    res.header("ETag", `"${etag}"`).status(200).send();
  } catch (error) {
    console.error("Upload part error:", error);
    res.status(500).send({
      error: "Failed to upload part",
    });
  }
});

// Complete multipart upload
fastify.post("/api/complete-multipart-upload/", async (req, res) => {
  try {
    const { uploadId, parts } = req.body;
    const uploadState = multipartUploads.get(uploadId);

    if (!uploadState) {
      return res.status(404).json({
        error: "Upload ID not found",
      });
    }

    // Verify all parts exist and ETags match
    for (const { PartNumber, ETag } of parts) {
      const part = uploadState.parts.get(PartNumber);
      if (!part || part.etag !== ETag) {
        console.log("part:", part, ETag, PartNumber);
        return res.status(400).send({
          error: "Part verification failed",
        });
      }
    }

    // Combine all parts into final file
    const finalFilePath = path.join(UPLOAD_DIR, uploadState.filename);

    const writeStream = fsWrite.createWriteStream(finalFilePath);

    for (let i = 1; i <= parts.length; i++) {
      const part = uploadState.parts.get(i);
      const partData = await fs.readFile(part.path);
      writeStream.write(partData);

      // Clean up part file
      await fs.unlink(part.path);
    }

    writeStream.end();

    // Wait for file to be written
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Update upload state
    uploadState.status = "completed";
    uploadState.finalPath = finalFilePath;
    uploadState.completedAt = Date.now();

    // Simulate completion delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      message: "Upload completed successfully",
      location: `/uploads/${uploadState.filename}`,
    };
  } catch (error) {
    console.error("Complete upload error:", error);
    res.status(500).send({
      error: "Failed to complete upload",
    });
  }
});

fastify.post("/api/complete-interview-upload/", async (req, res) => {
  try {
    const { ...props } = req.body;

    return {
      message: "Upload completed successfully",
    };
  } catch (error) {
    console.error("Complete upload error:", error);
    res.status(500).send({
      error: "Failed to complete upload",
    });
  }
});

// Step 5: Start the Server
const startServer = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server is running on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    // process.env.exit(1);
  }
};

startServer();
