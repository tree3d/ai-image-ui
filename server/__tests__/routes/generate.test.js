import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import { app } from "../../index.js"

describe("POST /generate", () => {
  it("returns 400 when prompt is missing", async () => {
    const res = await request(app).post("/generate").send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/prompt/i)
  })

  it("returns 400 when prompt is empty string", async () => {
    const res = await request(app).post("/generate").send({ prompt: "  " })
    expect(res.status).toBe(400)
  })

  it("returns image and filename on success", async () => {
    const res = await request(app)
      .post("/generate")
      .send({ prompt: "a cat", size: "1024x1024", quality: "medium" })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("image")
    expect(res.body).toHaveProperty("filename")
    expect(res.body.mimeType).toBe("image/png")
  })

  it("returns 500 when OpenAI throws", async () => {
    const { default: OpenAI } = await import("openai")
    // The server creates its openai instance at module load; target that instance directly
    const instance = OpenAI._instances[0]
    instance.images.generate.mockRejectedValueOnce(new Error("API down"))
    instance.images.edit.mockRejectedValueOnce(new Error("API down"))
    const res = await request(app)
      .post("/generate")
      .send({ prompt: "a cat" })
    expect(res.status).toBe(500)
  })
})
