# AI Image UI GPT-2 Native

Local Vue + Express app for generating, editing, inpainting, outpainting, and animating images. Uses OpenAI gpt-image-1 for image generation and fal.ai xai/grok-imagine-video for image-to-video animation. The frontend manages prompts, reference images, masks, a job gallery, and a usage/cost stats dashboard; the backend handles uploads, generation, crop-stitch inpainting, background jobs, and runtime file storage.

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

For the usage/cost stats dashboard, also set an Admin key (create one at platform.openai.com/settings/organization/admin-keys):

```bash
OPENAI_ADMIN_KEY=sk-admin-your-admin-key-here
```

For image-to-video animation via fal.ai, set a fal.ai API key (get one at fal.ai/dashboard/keys):

```bash
FAL_KEY=your-fal-api-key-here
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
