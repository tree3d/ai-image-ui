# AI Image UI GPT-2 Native

Local Vue + Express app for generating, editing, inpainting, and outpainting images with OpenAI image models. The frontend manages prompts, reference images, masks, gallery jobs, and downloads; the backend handles uploads, image generation requests, crop-stitch inpainting, and runtime file storage.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

Then edit `.env` and set:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

Optional values:

```bash
OPENAI_IMAGE_MODEL=gpt-image-2
PORT=5010
```

## Startup Commands

Run the frontend and backend together:

```bash
npm run dev
```

Frontend only:

```bash
npm run vite
```

The Vite app runs on:

```text
http://localhost:5174
```

Backend only:

```bash
npm run server
```

The Express server runs on:

```text
http://localhost:5010
```

## Runtime Folders

Generated and uploaded image files are stored locally in ignored runtime folders:

```text
input/
output/
mask/
crop-stitch/
uploads/
```
