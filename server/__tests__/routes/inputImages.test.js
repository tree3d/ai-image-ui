import { describe, it, expect } from "vitest"
import request from "supertest"
import { app } from "../../index.js"
import fs from "fs"

describe("DELETE /input-images/:filename", () => {
  it("strips path traversal and returns 404", async () => {
    fs.existsSync.mockReturnValue(false)
    const res = await request(app).delete("/input-images/..%2F..%2F.env")
    // path.basename strips the traversal — file won't exist → 404
    expect(res.status).toBe(404)
  })

  it("returns 404 for a file that does not exist", async () => {
    fs.existsSync.mockReturnValue(false)
    const res = await request(app).delete("/input-images/ghost.png")
    expect(res.status).toBe(404)
  })

  it("deletes file and returns 200", async () => {
    fs.existsSync.mockReturnValue(true)
    const res = await request(app).delete("/input-images/some-image.png")
    expect(res.status).toBe(200)
    expect(fs.unlinkSync).toHaveBeenCalled()
  })
})

describe("POST /input-images/order", () => {
  it("saves order and returns 200", async () => {
    fs.readdirSync.mockReturnValue(["a.png", "b.png"])
    const res = await request(app)
      .post("/input-images/order")
      .send({ order: ["b.png", "a.png"] })
    expect(res.status).toBe(200)
    expect(res.body.order).toEqual(["b.png", "a.png"])
  })

  it("ignores filenames not present on disk", async () => {
    fs.readdirSync.mockReturnValue(["a.png"])
    const res = await request(app)
      .post("/input-images/order")
      .send({ order: ["a.png", "ghost.png"] })
    expect(res.status).toBe(200)
    expect(res.body.order).toEqual(["a.png"])
  })
})
