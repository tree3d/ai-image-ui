import { vi } from "vitest"

// Set env vars before any module imports
process.env.OPENAI_API_KEY = "sk-test-key"
process.env.OPENAI_ADMIN_KEY = "sk-admin-test-key"
process.env.FAL_KEY = "fal-test-key"
process.env.PORT = "0" // random port, avoids conflicts

// Mock fs — spread both as named exports and as default so both import styles work
vi.mock("fs", () => {
  const mockFs = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => "[]"),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    promises: {
      readFile: vi.fn(async () => Buffer.from("fake-image-data")),
      writeFile: vi.fn(async () => {}),
    },
  }
  return { default: mockFs, ...mockFs }
})

// Mock sharp — returns chainable stubs
vi.mock("sharp", () => {
  const chain = {
    metadata: vi.fn(async () => ({ width: 1024, height: 1024 })),
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(async () => Buffer.alloc(16)),
    toFile: vi.fn(async () => {}),
    extract: vi.fn().mockReturnThis(),
    extractChannel: vi.fn().mockReturnThis(),
    threshold: vi.fn().mockReturnThis(),
    dilate: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    negate: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
  }
  const sharpFn = vi.fn(() => chain)
  return { default: sharpFn }
})

// Mock OpenAI — vi.fn(regular function) so `new OpenAI()` works.
// Stores created instances in MockOpenAI._instances so tests can override methods.
vi.mock("openai", () => {
  const fakeB64 = Buffer.alloc(16).toString("base64")
  const _instances = []
  const MockOpenAI = vi.fn(function () {
    this.images = {
      edit: vi.fn(async () => ({ data: [{ b64_json: fakeB64 }] })),
      generate: vi.fn(async () => ({ data: [{ b64_json: fakeB64 }] })),
    }
    _instances.push(this)
  })
  MockOpenAI._instances = _instances
  return { default: MockOpenAI }
})

// Mock fal.ai client
vi.mock("@fal-ai/client", () => ({
  fal: {
    config: vi.fn(),
    storage: { upload: vi.fn(async () => "https://fal.ai/fake-url") },
    subscribe: vi.fn(async () => ({
      data: { video: { url: "https://fal.ai/fake-video.mp4" } }
    }))
  }
}))

// Mock global fetch for video download
global.fetch = vi.fn(async () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(16),
  json: async () => ({})
}))
