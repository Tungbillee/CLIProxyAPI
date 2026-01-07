# Research Report: Gemini API Multimodal Capabilities 2025-2026

**Ngày thực hiện:** 03 Tháng 1, 2026
**Chủ đề:** Gemini API Multimodal Input Formats & Video Processing
**Phiên bản:** v1.0

---

## Executive Summary

Gemini API 2025-2026 hỗ trợ đầy đủ khả năng multimodal (hình ảnh, video, âm thanh, text) với 3 phương pháp input chính: inline base64, URL trực tiếp, và File API.

**Key findings:**
- **Gemini 2.5 Pro/Flash**: Hỗ trợ multimodal native, xử lý tới 3 giờ video, 1 triệu token context
- **generateContent endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **File API**: Tải file tới 2GB, lưu trữ 48 giờ, miễn phí & tối ưu cho file lớn
- **Inline limit**: Tối đa 20MB tổng request size cho phương pháp inline
- **Định giá**: Dựa trên token consumption, với `media_resolution` control cho chi phí tối ưu

---

## Research Methodology

- **Nguồn consulted:** 5 web searches + 2 WebFetch analyses
- **Date range:** December 2024 - January 2026
- **Key search terms:**
  - Gemini API multimodal 2025 2026
  - generateContent endpoint image video
  - Gemini 2.5 capabilities
  - File API large upload
  - Base64 URL specifications

---

## Key Findings

### 1. Image Input Format Specifications

#### MIME Types Hỗ Trợ
```
- image/png        (PNG)
- image/jpeg       (JPEG)
- image/webp       (WebP)
- image/heic       (HEIC)
- image/heif       (HEIF)
```

#### Phương Pháp 1: Inline Base64
**Khi nào dùng:** Request size < 20MB, image nhỏ, reuse không cần
```javascript
// Pseudo-code
const imageData = {
  inlineData: {
    mimeType: "image/jpeg",
    data: base64EncodedImage
  }
};

const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      parts: [
        { text: "Phân tích hình ảnh này:" },
        imageData
      ]
    }
  ]
});
```

**Ưu điểm:**
- Không cần upload riêng
- Request tự chứa toàn bộ data
- Đơn giản cho file nhỏ

**Nhược điểm:**
- Base64 encoding tăng size ~33%
- Tối đa 20MB request total
- Không thể reuse

#### Phương Pháp 2: Direct URL
**Khi nào dùng:** Hình từ web server công khai
```javascript
const imageData = {
  fileData: {
    mimeType: "image/jpeg",
    fileUri: "https://example.com/image.jpg"
  }
};
```

**Hạn chế:**
- URL phải công khai accessible
- Model phải có quyền fetch

#### Phương Pháp 3: File API (Recommended)
**Khi nào dùng:** File > 20MB, reuse nhiều requests, production environment
```javascript
// Upload first
const uploadedFile = await client.files.upload({
  file: mediaFile,
  mimeType: "image/jpeg"
});

// Use in requests
const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      parts: [
        { text: "Phân tích:" },
        { fileData: { fileUri: uploadedFile.uri } }
      ]
    }
  ]
});
```

#### Token Cost (Gemini 2.0/2.5)
- Image ≤ 384px (both dims): **258 tokens**
- Larger images: **Tiled at 768x768px**, mỗi tile 258 tokens
- Example: 1536x1536px = 4 tiles × 258 = 1,032 tokens

#### Media Resolution Control (Gemini 3 New)
```javascript
// Control token allocation per image
generationConfig: {
  media_resolution: "media_resolution_high"  // Options: low/medium/high/ultra_high
}

// Token mapping (Gemini 3):
// low: 280 tokens
// medium: 560 tokens
// high: 1,120 tokens
// ultra_high: không support global, chỉ per-part
```

---

### 2. Video Input Format Specifications

#### MIME Types & Formats
```
Video formats: MP4, MPEG, MOV, AVI, FLV, MPG, WebM, WMV, 3GPP
MIME type: video/mp4, video/mpeg, video/quicktime, etc.
```

#### Phương Pháp 1: Inline Video (< 20MB)
```javascript
const videoData = {
  inlineData: {
    mimeType: "video/mp4",
    data: base64EncodedVideo
  }
};

const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      parts: [
        { text: "Summarize video:" },
        videoData
      ]
    }
  ]
});
```

**Constraint:**
- Tối đa 20MB inline total
- Tốc độ xử lý 1 frame/giây default

#### Phương Pháp 2: YouTube URL (Gemini 2.5+)
```javascript
const youtubeData = {
  fileData: {
    mimeType: "video/youtube",
    fileUri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
};

const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      parts: [
        { text: "What happens at 01:15?" },
        youtubeData
      ]
    }
  ]
});
```

**Timestamp format:** `MM:SS` (e.g., `01:15`)

**Giới hạn YouTube:**
- Free tier: Tối đa 8 giờ/ngày
- Paid tier: Không giới hạn
- Gemini 2.5+: Tối đa 10 video/request (< 2.5: 1 video/request)

#### Phương Pháp 3: File API (Recommended for Large Videos)
```javascript
// Upload video (up to 2GB)
const uploadedVideo = await client.files.upload({
  file: videoFile,
  mimeType: "video/mp4"
});

// Process with long-running videos
const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      parts: [
        { text: "Extract key scenes:" },
        { fileData: { fileUri: uploadedVideo.uri } }
      ]
    }
  ]
});
```

#### Video Processing Specifications

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Sampling rate** | 1 frame/sec (default) | Có thể giảm với `media_resolution_low` |
| **Max duration (default res)** | ~1 hour | Với Gemini 2.5 Pro |
| **Max duration (low res)** | ~3 hours | Với Gemini 2.5 Pro & 1M token context |
| **Token cost (default)** | ~300 tokens/sec | At default resolution |
| **Token cost (low res)** | ~100 tokens/sec | Optimized for long videos |
| **Max videos/request** | 10 (Gemini 2.5+) | 1 for earlier versions |
| **Audio per sec** | 32 tokens | Max 9.5 hours audio/request |

#### Media Resolution Impact
```javascript
// Video token estimation
const durationSeconds = 60;  // 1 minute
const defaultTokens = durationSeconds * 300;  // ~18,000 tokens
const lowResTokens = durationSeconds * 100;   // ~6,000 tokens

generationConfig: {
  media_resolution: "media_resolution_low"  // Save 3x tokens
}
```

---

### 3. generateContent Endpoint Structure

#### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

#### Endpoint Patterns
```
REST:  GET/POST  /v1beta/models/{model}:generateContent?key={API_KEY}
gRPC:  models.GenerativeService/GenerateContent
```

#### Complete Request Example
```http
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_API_KEY

Content-Type: application/json

{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "What's in this image?"
        },
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "base64_encoded_image_data"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "topP": 0.95,
    "topK": 40,
    "maxOutputTokens": 2048,
    "media_resolution": "media_resolution_high"
  },
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    }
  ]
}
```

#### Response Structure
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "The image shows..."
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [...]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 1200,
    "candidatesTokenCount": 156,
    "totalTokenCount": 1356
  }
}
```

#### Multimodal Request Rules
1. **Content array:** Chứa objects với `parts` (text/image/video/audio)
2. **Part ordering:**
   - Text + Image: Text trước, image sau
   - Text + Video: Video trước, text sau
   - Mixed media: Không có strict ordering
3. **Multiple parts:** Tất cả parts trong 1 request đều processed as equal-class inputs

#### Authentication
```
Header: x-goog-api-key: YOUR_API_KEY
or
Header: Authorization: Bearer {access_token}  (OAuth 2.0)
```

---

### 4. Models Supporting Multimodal (2025-2026)

#### Gemini 3 Series (Latest - 2026)
```
gemini-3-pro          ✓ Text, Image, Video, Audio (1M context)
gemini-3-flash        ✓ Text, Image, Video, Audio (1M context)
gemini-3-flash-lite   ✓ Text, Image, Video, Audio
```

**New in Gemini 3:**
- Media resolution control (`media_resolution_low/medium/high/ultra_high`)
- Better frame sampling efficiency
- Improved multimodal reasoning

#### Gemini 2.5 Series (Current Production)
```
gemini-2.5-pro          ✓ Text, Image, Video, Audio
  - 1M token context
  - Thinking capability
  - Up to 3 hours video
  - Advanced reasoning

gemini-2.5-flash        ✓ Text, Image, Video, Audio
  - 1M token context
  - Hybrid reasoning (controllable budget)
  - Good balance: quality/latency/cost

gemini-2.5-flash-lite   ✓ Text, Image, Audio
  - Fast inference
  - Lower cost
  - Better than 2.0 Flash-Lite
```

#### Gemini 2.0 Series (Legacy)
```
gemini-2.0-flash       ✓ Text, Image, Video, Audio
gemini-2.0-flash-lite  ✓ Text, Image, Audio
```

#### Model Selection Matrix
| Use Case | Recommended | Reason |
|----------|-------------|--------|
| **High quality, complex reasoning** | gemini-2.5-pro / gemini-3-pro | Best quality, thinking |
| **Balanced production** | gemini-2.5-flash / gemini-3-flash | Quality + speed + cost |
| **Fast response, cost-sensitive** | gemini-2.5-flash-lite | Lower latency/cost |
| **Video-to-code, complex multimodal** | gemini-2.5-pro | Native multimodal strength |
| **Edge/mobile deployment** | (Not available via API) | Consider nano models |

#### Audio Specifications
```
Max duration: 9.5 hours per request
Token cost: 32 tokens per second
Supported: Speech & non-speech (bird songs, sirens, music)
Format: WAV, MP3, AIFF, FLAC, OGG, OPUS
```

---

### 5. File API Specifications

#### Core Capabilities
```
Upload limit per file: 2 GB
Storage quota: 20 GB per project
Retention: 48 hours (auto-delete)
Authentication: API Key
Protocol: Resumable upload (2-phase)
```

#### Upload Methods

**Python SDK:**
```python
from google import genai

client = genai.Client(api_key="YOUR_API_KEY")

# Upload image
image_file = client.files.upload(
    file="path/to/image.jpg"
)

# Upload video
video_file = client.files.upload(
    file="path/to/video.mp4"
)

# Upload PDF/Document
pdf_file = client.files.upload(
    file="path/to/document.pdf"
)

# Use in generation
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        "Analyze this file:",
        video_file,  # SDK automatically converts to fileUri
    ]
)
```

**cURL/REST:**
```bash
curl -X POST https://generativelanguage.googleapis.com/upload/v1beta/files \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@video.mp4"

# Response contains fileUri
# "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/abc123..."
```

#### Resumable Upload Protocol
```
Phase 1: POST /upload/v1beta/files
  - Request with X-Goog-Upload-Protocol: resumable
  - Returns session_uri

Phase 2: PUT {session_uri}
  - Upload file chunks with X-Goog-Upload-Offset
  - Handles connection failures gracefully
```

#### File Lifecycle
```
1. Upload → File stored in Google's infrastructure
2. 48 hour window → File accessible via URI
3. Auto-delete → After 48 hours
4. Re-upload if needed → New 48 hour window
```

#### Document/PDF Support
```
Max size: 50 MB (inline) / 2 GB (File API)
Max pages: 1,000 pages
Token cost: 258 tokens per page
Formats: PDF, DOCX, PPTX, TXT, RTF
```

#### Security Considerations
```
⚠️ CRITICAL: API Key grants full access to uploaded files
- Keep API keys secure & never expose in client code
- Use server-side uploads only
- Implement access controls on your backend
- Rotate keys regularly
- Monitor for abuse with quota alerts
```

---

### 6. Integration Patterns & Best Practices

#### Inline vs File API Decision Tree
```
File size?
├─ < 5 MB → Consider inline base64
│   ├─ Reuse needed? → Yes → Use File API
│   └─ Single request? → Yes → Inline OK
├─ 5-20 MB → Inline possible but not ideal
│   └─ Use File API unless single request only
└─ > 20 MB → MUST use File API
```

#### Batch Processing Pattern
```javascript
// Process multiple videos efficiently
const videos = ['video1.mp4', 'video2.mp4', 'video3.mp4'];
const uploadedFiles = [];

// Upload once, reuse multiple times
for (const video of videos) {
  const file = await client.files.upload({ file: video });
  uploadedFiles.push(file);
}

// Process with different prompts
for (const file of uploadedFiles) {
  const summary = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: ["Summarize:", file]
  });

  const analysis = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: ["Analyze sentiment:", file]
  });
}
```

#### Video Streaming Pattern (for Async)
```javascript
// For long videos, use streaming with timeout
const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    "Extract timestamps of scene changes:",
    uploadedVideo
  ],
  generationConfig: {
    media_resolution: "media_resolution_low"  // Reduce cost
  }
});

// Stream responses as they arrive
for await (const chunk of response) {
  console.log(chunk.text);
}
```

#### Cost Optimization Pattern
```javascript
// Strategy 1: Use media_resolution_low for batch processing
generationConfig: {
  media_resolution: "media_resolution_low"  // 100 tokens/sec vs 300
}

// Strategy 2: Batch multiple short videos
const shortVideos = videos.filter(v => v.duration < 30);  // < 30 sec each

// Strategy 3: Reuse uploaded files
// Upload once, use 100x = massive savings

// Token estimate
const estimateTokens = (durationSec, resolution) => {
  const rates = { low: 100, default: 300 };
  return durationSec * rates[resolution];
};

console.log(estimateTokens(3600, 'low'));      // 360k tokens (1 hour)
console.log(estimateTokens(3600, 'default'));  // 1.08M tokens
```

---

### 7. Current Limitations & Considerations

#### Known Constraints (Jan 2026)
```
Maximum files per request:
  ├─ Images: 3,600 images
  ├─ Videos: 10 videos (Gemini 2.5+)
  ├─ Audio: Limited to 9.5 hours total
  └─ Mixed: Various limits apply

Inline request size: 20 MB max (total with text)
File size: 2 GB max per file
File retention: 48 hours only
```

#### Performance Considerations
```
Latency implications:
  - Base64 encoding/decoding: Add overhead
  - File API upload: One-time cost
  - Video processing: 1 frame/sec default
  - Large videos: Use low resolution mode
```

#### Quality & Accuracy
```
Best practices:
  - Clear, non-blurry images
  - Image positioning: After text in parts array
  - Video frame rate: 1 fps often sufficient
  - Ambiguous video moments: Reference timestamps
  - Fast action sequences: May lose detail (1 fps sampling)
```

---

## Comparative Analysis

### Input Format Comparison

| Feature | Inline Base64 | Direct URL | File API |
|---------|---------------|-----------|----------|
| **Max size** | 20MB (shared) | Unlimited (URL hosted) | 2 GB |
| **Setup time** | Instant | Instant | Upload delay |
| **Reusability** | No | Yes | Yes |
| **Cost (reuse)** | High | Medium | Low |
| **Security** | Base64 in request | URL exposure | Secure upload |
| **Best for** | Small, single-use | Web resources | Large/batch |
| **Latency** | Low | Medium | Medium |

### Model Capability Comparison

| Feature | Gemini 2.5 Pro | Gemini 2.5 Flash | Gemini 3 Flash |
|---------|---|---|---|
| **Max video** | 3 hours | ~1 hour | ~1 hour |
| **Video quality** | Best | Good | Good+ |
| **Reasoning** | Thinking (best) | Hybrid | Hybrid |
| **Speed** | Slower | Fast | Fast |
| **Cost** | Higher | Medium | Medium |
| **Multimodal** | Excellent | Excellent | Excellent |
| **Use case** | Complex analysis | Production | Production |

---

## Implementation Recommendations

### Quick Start Guide

#### Setup Authentication
```bash
# Obtain API key from Google AI Studio
export GOOGLE_API_KEY="your_api_key_here"

# Install SDK
npm install @google/generative-ai  # JavaScript
pip install google-generativeai      # Python
```

#### Process Image (Node.js)
```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function analyzeImage(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");

  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  const result = await model.generateContent({
    contents: [{
      parts: [
        { text: "Describe this image in detail:" },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64
          }
        }
      ]
    }],
    generationConfig: {
      media_resolution: "media_resolution_high"
    }
  });

  console.log(result.response.text());
}

analyzeImage("image.jpg");
```

#### Process Video with File API (Python)
```python
from google import genai

client = genai.Client(api_key="YOUR_API_KEY")

# Upload video
print("Uploading video...")
video_file = client.files.upload(
    file="path/to/video.mp4"
)
print(f"Video uploaded: {video_file.uri}")

# Process video
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        "Summarize the key events and timestamps in this video:",
        video_file,
    ],
    config=genai.types.GenerateContentConfig(
        temperature=0.7,
    )
)

print("Summary:")
print(response.text)

# File auto-deletes after 48 hours
# Or explicitly delete
client.files.delete(video_file.name)
```

#### Multi-Modal Chat UI Pattern
```javascript
async function multimodalChat(userMessage, imageFile, videoFile) {
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  const parts = [{ text: userMessage }];

  // Add image if provided
  if (imageFile) {
    parts.push({
      inlineData: {
        mimeType: imageFile.type,
        data: await fileToBase64(imageFile)
      }
    });
  }

  // Add video using File API for better UX
  if (videoFile) {
    const uploaded = await client.files.upload({
      file: videoFile
    });
    parts.push({
      fileData: {
        fileUri: uploaded.uri
      }
    });
  }

  return await model.generateContent({
    contents: [{ parts }],
    generationConfig: {
      media_resolution: "media_resolution_high"
    }
  });
}

// Helper
async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}
```

---

### Common Pitfalls & Solutions

#### Pitfall 1: Exceeding 20MB Inline Limit
```javascript
// ❌ WRONG: Single request > 20MB
const image = fs.readFileSync("large.jpg");  // 25 MB
const request = {
  contents: [{
    parts: [
      { text: "Analyze" },
      { inlineData: { mimeType: "image/jpeg", data: base64(image) } }
    ]
  }]
};

// ✅ CORRECT: Use File API
const uploadedImage = await client.files.upload({ file: "large.jpg" });
const request = {
  contents: [{
    parts: [
      { text: "Analyze" },
      { fileData: { fileUri: uploadedImage.uri } }
    ]
  }]
};
```

#### Pitfall 2: Fast Action Video Loss
```javascript
// ❌ WRONG: High resolution for sports footage
{
  contents: [{ parts: [{ text: "Analyze plays" }, video] }],
  generationConfig: {
    media_resolution: "media_resolution_high"  // May miss fast motion
  }
}

// ✅ CORRECT: Request specific timestamps instead
{
  contents: [{
    parts: [
      { text: "What happens at 00:15? Is it a goal?" },
      video
    ]
  }],
  generationConfig: {
    media_resolution: "media_resolution_medium"
  }
}
```

#### Pitfall 3: Ignoring 48-Hour File Expiration
```javascript
// ❌ WRONG: Upload once, use next day
const file = await client.files.upload({ file: "video.mp4" });
// ... next day ...
const response = await client.models.generateContent({
  contents: [{ parts: [{ text: "Analyze" }, file] }]  // File expired!
});

// ✅ CORRECT: Re-upload or track expiration
class FileManager {
  async getOrUploadFile(filepath) {
    const cached = this.cache.get(filepath);
    if (cached && Date.now() - cached.uploadTime < 24 * 60 * 60 * 1000) {
      return cached.file;
    }
    const file = await client.files.upload({ file: filepath });
    this.cache.set(filepath, { file, uploadTime: Date.now() });
    return file;
  }
}
```

#### Pitfall 4: Text Positioning in Multimodal
```javascript
// ❌ WRONG: Image before text
{
  contents: [{
    parts: [
      { inlineData: { mimeType: "image/jpeg", data: base64 } },
      { text: "What's in this?" }
    ]
  }]
}

// ✅ CORRECT: Text before image (for best results)
{
  contents: [{
    parts: [
      { text: "What's in this?" },
      { inlineData: { mimeType: "image/jpeg", data: base64 } }
    ]
  }]
}
```

#### Pitfall 5: Exposing API Key in Client Code
```javascript
// ❌ WRONG: API key in frontend
const client = new GoogleGenerativeAI("sk-...");  // Exposed!

// ✅ CORRECT: Backend proxy pattern
// Frontend
const response = await fetch("/api/analyze", {
  method: "POST",
  body: JSON.stringify({ imageData, prompt })
});

// Backend
app.post("/api/analyze", async (req, res) => {
  const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const result = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      parts: [
        { text: req.body.prompt },
        { inlineData: { mimeType: "image/jpeg", data: req.body.imageData } }
      ]
    }]
  });
  res.json({ result: result.response.text() });
});
```

---

## Resources & References

### Official Documentation
- [Gemini API Overview](https://ai.google.dev/gemini-api/docs)
- [Image Understanding Guide](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Video Understanding Guide](https://ai.google.dev/gemini-api/docs/video-understanding)
- [File API Reference](https://ai.google.dev/gemini-api/docs/files)
- [Generating Content Reference](https://ai.google.dev/api/generate-content)
- [Gemini Models Documentation](https://ai.google.dev/gemini-api/docs/models)
- [Changelog & Release Notes](https://ai.google.dev/gemini-api/docs/changelog)

### Technical Blogs & Guides
- [Google Gemini Multimodal Input 2025](https://www.datastudios.org/post/google-gemini-multimodal-input-in-2025-vision-audio-and-video-capabilities-explained)
- [Google Gemini 2.5 Pro & Flash Complete Guide](https://www.codegpt.co/blog/google-gemini-2-5-pro-flash)
- [Gemini 3 API Updates](https://developers.googleblog.com/new-gemini-api-updates-for-gemini-3/)
- [Gemini 3 Flash Benchmarks](https://blog.google/products/gemini/gemini-3-flash/)
- [7 Examples of Gemini Multimodal in Action](https://developers.googleblog.com/en/7-examples-of-geminis-multimodal-capabilities-in-action/)

### SDK & Code Examples
- [Google Generative AI Python SDK](https://github.com/google-gemini/python-client)
- [Google Generative AI Node.js SDK](https://github.com/google/generative-ai-js)
- [Gemini Cookbook (Examples)](https://github.com/google-gemini/cookbook)
- [File API Quickstart](https://github.com/google-gemini/cookbook/blob/main/quickstarts/File_API.ipynb)

### Community Resources
- [Stack Overflow Tag: google-gemini](https://stackoverflow.com/questions/tagged/google-gemini)
- [Google AI Forums](https://discuss.ai.google.dev/)
- [GitHub Discussions](https://github.com/google-gemini/python-client/discussions)

### Advanced Topics
- [Gemini 2.5 Paper (ArXiv)](https://arxiv.org/html/2507.06261v1)
- [Gemini 2.5 Technical Report (PDF)](https://storage.googleapis.com/deepmind-media/gemini/gemini_v2_5_report.pdf)
- [Vertex AI Integration Guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api)
- [Firebase AI Logic Integration](https://firebase.google.com/docs/ai-logic/input-file-requirements)

---

## Appendices

### A. MIME Type Reference
```
Images:
  image/jpeg          JPG files
  image/png           PNG files
  image/webp          WebP files
  image/heic          HEIC files (Apple)
  image/heif          HEIF files (Apple)

Video:
  video/mp4           MP4 (H.264)
  video/mpeg          MPEG
  video/quicktime     MOV
  video/x-msvideo     AVI
  video/x-flv         FLV
  video/webm          WebM
  video/x-ms-wmv      WMV
  video/3gpp          3GPP

Audio:
  audio/wav           WAV
  audio/mpeg          MP3
  audio/aiff          AIFF
  audio/flac          FLAC
  audio/ogg           OGG Vorbis
  audio/opus          Opus

Documents:
  application/pdf     PDF
  application/vnd.openxmlformats-officedocument.wordprocessingml.document     DOCX
  application/vnd.openxmlformats-officedocument.presentationml.presentation    PPTX
  text/plain          TXT
  application/rtf     RTF
```

### B. Token Cost Estimation

#### Image Tokens
```
Gemini 2.0/2.5:
  ≤384px (both dims):     258 tokens
  385-768px:              4 × 258 = 1,032 tokens (2×2 tiling)
  769-1536px:             9 × 258 = 2,322 tokens (3×3 tiling)
  1537-2304px:            16 × 258 = 4,128 tokens (4×4 tiling)

Gemini 3 (with media_resolution):
  media_resolution_low:     280 tokens per image
  media_resolution_medium:  560 tokens per image
  media_resolution_high:    1,120 tokens per image
  media_resolution_ultra_high: Higher (per-part only)
```

#### Video Tokens
```
Gemini 2.0/2.5 (default resolution):
  ~300 tokens/second of video

Gemini 2.0/2.5 (low resolution):
  ~100 tokens/second of video

Examples:
  30 sec video (default):  30 × 300 = 9,000 tokens
  30 sec video (low res):  30 × 100 = 3,000 tokens
  1 hour video (low res):  3,600 × 100 = 360,000 tokens
  3 hour video (low res):  3.3M tokens (within 1M context with careful usage)
```

#### Audio Tokens
```
32 tokens per second
9.5 hour max per request

Examples:
  1 minute audio:   60 × 32 = 1,920 tokens
  1 hour audio:     3,600 × 32 = 115,200 tokens
  9.5 hour audio:   34,200 × 32 = 1,094,400 tokens
```

### C. Version Feature Matrix

| Feature | Gemini 2.0 | Gemini 2.5 | Gemini 3 |
|---------|-----------|-----------|---------|
| **Images** | ✓ | ✓ | ✓ |
| **Video** | ✓ | ✓ (3h) | ✓ |
| **Audio** | ✓ | ✓ (9.5h) | ✓ |
| **Context** | 1M | 1M | 1M |
| **Thinking** | - | ✓ (Pro) | ✓ |
| **Media Resolution** | - | - | ✓ |
| **Multi-video** | 1 | 10 | 10 |
| **Ultra High Res** | - | - | ✓ |
| **File API** | ✓ | ✓ | ✓ |
| **Grounding** | - | ✓ | ✓ |

---

## Unresolved Questions

1. **Gemini 3 Pricing**: Exact pricing for Gemini 3 models not fully published (expected soon)
2. **Ultra High Resolution Cost**: Token cost for `media_resolution_ultra_high` mode unclear
3. **Audio-only Processing**: Limited documentation on pure audio analysis (non-transcription)
4. **Batch API Timeline**: When will Gemini API have dedicated Batch API like text models?
5. **Edge Deployment**: Timeline for Gemini multimodal models on edge devices (mobile)

---

**Report Generated:** January 3, 2026
**Last Updated:** 2026-01-03 14:30 UTC
**Data Currency:** Based on sources from Dec 2024 - Jan 2026
