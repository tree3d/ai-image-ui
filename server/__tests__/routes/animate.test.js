import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import { app } from "../../index.js"
import fs from "fs"

describe("POST /animate", () => {
  it("returns 401 when FAL_KEY is not set", async () => {
    const original = process.env.FAL_KEY
    delete process.env.FAL_KEY
    const res = await request(app).post("/animate").send({ filename: "test.png", prompt: "move" })
    process.env.FAL_KEY = original
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/FAL_KEY/i)
  })

  it("returns 400 when filename is missing", async () => {
    const res = await request(app).post("/animate").send({ prompt: "move" })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/filename/i)
  })

  it("returns 400 when prompt is missing", async () => {
    const res = await request(app).post("/animate").send({ filename: "test.png" })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/prompt/i)
  })

  it("returns 404 when source file does not exist in output or input dirs", async () => {
    fs.existsSync.mockReturnValue(false)
    const res = await request(app)
      .post("/animate")
      .send({ filename: "ghost.png", prompt: "move" })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it("returns jobId when source file exists", async () => {
    fs.existsSync.mockReturnValue(true)
    const res = await request(app)
      .post("/animate")
      .send({ filename: "real.png", prompt: "camera pan", duration: 6, resolution: "720p" })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("jobId")
    expect(typeof res.body.jobId).toBe("string")
  })
})
