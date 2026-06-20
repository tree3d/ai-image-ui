import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import { app } from "../../index.js"

describe("GET /status/:jobId", () => {
  it("returns 404 for unknown jobId", async () => {
    const res = await request(app).get("/status/nonexistent-id")
    expect(res.status).toBe(404)
    expect(res.body.error).toBe("Job not found")
  })
})
