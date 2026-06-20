import multer from "multer"
import express from "express"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import FormData from "form-data"
import mime from "mime-types"
import sharp from "sharp"
import { toFile } from "openai/uploads"
import OpenAI from "openai"
import { fal } from "@fal-ai/client"
import cors from "cors"
import dotenv from "dotenv"
import {
  CROP_STITCH_DIR,
  INPUT_DIR,
  LAST_PROMPT_FILE,
  MASK_DIR,
  OUTPUT_DIR
} from "./utils/paths.js"

dotenv.config()

fal.config({ credentials: process.env.FAL_KEY })

const app = express()
app.use(cors({ origin: "http://localhost:5174" }))
app.use(express.json({ limit: "10mb" }))

const PORT = process.env.PORT || 5010

// In-memory job store for background generation.
// Each entry: { status: 'pending'|'done'|'error', result?, error?, completedAt? }
const pendingJobs = new Map()

// Purge completed jobs older than 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [id, job] of pendingJobs.entries()) {
    if (job.completedAt && job.completedAt < cutoff) pendingJobs.delete(id)
  }
}, 60_000)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

for (const dir of [OUTPUT_DIR, INPUT_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

app.use("/output", express.static(OUTPUT_DIR))
app.use("/input", express.static(INPUT_DIR))

if (!fs.existsSync(CROP_STITCH_DIR)) {
  fs.mkdirSync(CROP_STITCH_DIR, { recursive: true })
}

app.get("/status/:jobId", (req, res) => {
  const job = pendingJobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: "Job not found" })
  if (job.status === "pending") return res.json({ status: "pending" })
  res.json({ status: job.status, result: job.result, error: job.error })
})

const bufferToOpenAIFile = async (buffer, filename, type = "image/png") => {
  return await toFile(buffer, filename, { type })
}

const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)))

const floatRgbaToBuffer = (arr) => {
  const out = Buffer.alloc(arr.length)

  for (let i = 0; i < arr.length; i++) {
    out[i] = clampByte(arr[i])
  }

  return out
}

const resizeRawRgba = async ({ data, width, height, targetWidth, targetHeight }) => {
  const input = floatRgbaToBuffer(data)

  const { data: resized, info } = await sharp(input, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .resize(targetWidth, targetHeight, {
      fit: "fill"
    })
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    data: Float32Array.from(resized),
    width: info.width,
    height: info.height
  }
}

const imageBufferToRawRgba = async (buffer, width, height) => {
  const { data, info } = await sharp(buffer)
    .resize(width, height, {
      fit: "fill"
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    data: Float32Array.from(data),
    width: info.width,
    height: info.height
  }
}

const maskBufferToRawGray = async (buffer, width, height) => {
  const { data } = await sharp(buffer)
    .resize(width, height, {
      fit: "fill"
    })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return Float32Array.from(data)
}

const buildGaussianPyramid = async (base, levels) => {
  const pyramid = [base]

  for (let i = 1; i < levels; i++) {
    const prev = pyramid[i - 1]

    const targetWidth = Math.max(1, Math.round(prev.width / 2))
    const targetHeight = Math.max(1, Math.round(prev.height / 2))

    pyramid.push(
      await resizeRawRgba({
        data: prev.data,
        width: prev.width,
        height: prev.height,
        targetWidth,
        targetHeight
      })
    )
  }

  return pyramid
}

const buildMaskPyramid = async (baseMask, width, height, levels) => {
  const pyramid = [
    {
      data: baseMask,
      width,
      height
    }
  ]

  for (let i = 1; i < levels; i++) {
    const prev = pyramid[i - 1]

    const input = Buffer.from(
      Uint8Array.from(prev.data.map(clampByte))
    )

    const targetWidth = Math.max(1, Math.round(prev.width / 2))
    const targetHeight = Math.max(1, Math.round(prev.height / 2))

    const { data, info } = await sharp(input, {
      raw: {
        width: prev.width,
        height: prev.height,
        channels: 1
      }
    })
      .resize(targetWidth, targetHeight, {
        fit: "fill"
      })
      .raw()
      .toBuffer({ resolveWithObject: true })

    pyramid.push({
      data: Float32Array.from(data),
      width: info.width,
      height: info.height
    })
  }

  return pyramid
}

const buildLaplacianPyramid = async (gaussian) => {
  const laplacian = []

  for (let i = 0; i < gaussian.length - 1; i++) {
    const current = gaussian[i]
    const next = gaussian[i + 1]

    const upsampled = await resizeRawRgba({
      data: next.data,
      width: next.width,
      height: next.height,
      targetWidth: current.width,
      targetHeight: current.height
    })

    const diff = new Float32Array(current.data.length)

    for (let p = 0; p < current.data.length; p++) {
      diff[p] = current.data[p] - upsampled.data[p]
    }

    laplacian.push({
      data: diff,
      width: current.width,
      height: current.height
    })
  }

  laplacian.push(gaussian[gaussian.length - 1])

  return laplacian
}

const multiBandBlend = async ({
  sourceBuffer,
  editedBuffer,
  maskBuffer,
  width,
  height,
  levels = 5
}) => {
  const source = await imageBufferToRawRgba(sourceBuffer, width, height)
  const edited = await imageBufferToRawRgba(editedBuffer, width, height)
  const mask = await maskBufferToRawGray(maskBuffer, width, height)

  const sourceGaussian = await buildGaussianPyramid(source, levels)
  const editedGaussian = await buildGaussianPyramid(edited, levels)
  const maskGaussian = await buildMaskPyramid(mask, width, height, levels)

  const sourceLaplacian = await buildLaplacianPyramid(sourceGaussian)
  const editedLaplacian = await buildLaplacianPyramid(editedGaussian)

  const blendedPyramid = []

  for (let level = 0; level < levels; level++) {
    const src = sourceLaplacian[level]
    const edt = editedLaplacian[level]
    const msk = maskGaussian[level]

    const blended = new Float32Array(src.data.length)

    for (let i = 0; i < src.width * src.height; i++) {
      const m = msk.data[i] / 255
      const rgba = i * 4

      blended[rgba] =
        edt.data[rgba] * m + src.data[rgba] * (1 - m)

      blended[rgba + 1] =
        edt.data[rgba + 1] * m + src.data[rgba + 1] * (1 - m)

      blended[rgba + 2] =
        edt.data[rgba + 2] * m + src.data[rgba + 2] * (1 - m)

      blended[rgba + 3] = 255
    }

    blendedPyramid.push({
      data: blended,
      width: src.width,
      height: src.height
    })
  }

  let current = blendedPyramid[levels - 1]

  for (let level = levels - 2; level >= 0; level--) {
    const lap = blendedPyramid[level]

    const upsampled = await resizeRawRgba({
      data: current.data,
      width: current.width,
      height: current.height,
      targetWidth: lap.width,
      targetHeight: lap.height
    })

    const reconstructed = new Float32Array(lap.data.length)

    for (let i = 0; i < lap.data.length; i++) {
      reconstructed[i] = upsampled.data[i] + lap.data[i]
    }

    current = {
      data: reconstructed,
      width: lap.width,
      height: lap.height
    }
  }

  return await sharp(floatRgbaToBuffer(current.data), {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer()
}

const getMaskInfo = async (maskPath) => {
  const { data, info } = await sharp(maskPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1

  const editMap = new Uint8Array(info.width * info.height)

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      const isPainted = a > 10 && r + g + b > 40

      if (isPainted) {
        editMap[y * info.width + x] = 255
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null
  }

  return {
    width: info.width,
    height: info.height,
    editMap,
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }
  }
}

const createOpenAIMaskCrop = async ({ maskInfo, crop }) => {
  const rgba = Buffer.alloc(crop.width * crop.height * 4)

  for (let y = 0; y < crop.height; y++) {
    for (let x = 0; x < crop.width; x++) {
      const sourceX = crop.left + x
      const sourceY = crop.top + y
      const sourceIndex = sourceY * maskInfo.width + sourceX
      const targetIndex = (y * crop.width + x) * 4

      const painted = maskInfo.editMap[sourceIndex] === 255

      rgba[targetIndex] = 255
      rgba[targetIndex + 1] = 255
      rgba[targetIndex + 2] = 255

      // OpenAI edit area = transparent
      rgba[targetIndex + 3] = painted ? 0 : 255
    }
  }

  return await sharp(rgba, {
    raw: {
      width: crop.width,
      height: crop.height,
      channels: 4
    }
  })
    .png()
    .toBuffer()
}

const createStitchAlphaMask = ({ maskInfo, crop }) => {
  const alpha = Buffer.alloc(crop.width * crop.height)

  for (let y = 0; y < crop.height; y++) {
    for (let x = 0; x < crop.width; x++) {
      const sourceX = crop.left + x
      const sourceY = crop.top + y
      const sourceIndex = sourceY * maskInfo.width + sourceX

      alpha[y * crop.width + x] =
        maskInfo.editMap[sourceIndex] === 255 ? 255 : 0
    }
  }

  return alpha
}

const clampNumber = (value, min, max) => {
  return Math.max(min, Math.min(max, value))
}

const buildCropAroundMask = ({
  bbox,
  sourceWidth,
  sourceHeight,
  padding = 96,
  minSize = 256
}) => {
  const safePadding = clampNumber(Number(padding) || 0, 0, 1024)
  const safeMinSize = Math.min(minSize, sourceWidth, sourceHeight)

  let left = bbox.x - safePadding
  let top = bbox.y - safePadding
  let right = bbox.x + bbox.width + safePadding
  let bottom = bbox.y + bbox.height + safePadding

  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const width = Math.max(right - left, safeMinSize)
  const height = Math.max(bottom - top, safeMinSize)

  left = Math.round(centerX - width / 2)
  right = Math.round(centerX + width / 2)
  top = Math.round(centerY - height / 2)
  bottom = Math.round(centerY + height / 2)

  if (left < 0) {
    right -= left
    left = 0
  }

  if (top < 0) {
    bottom -= top
    top = 0
  }

  if (right > sourceWidth) {
    left -= right - sourceWidth
    right = sourceWidth
  }

  if (bottom > sourceHeight) {
    top -= bottom - sourceHeight
    bottom = sourceHeight
  }

  left = clampNumber(left, 0, sourceWidth - 1)
  top = clampNumber(top, 0, sourceHeight - 1)
  right = clampNumber(right, left + 1, sourceWidth)
  bottom = clampNumber(bottom, top + 1, sourceHeight)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  }
}

const uploadCropStitch = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CROP_STITCH_DIR),
    filename: (req, file, cb) => cb(null, `${file.fieldname}-${randomHash()}.png`)
  }),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
})

app.post(
  "/inpaint-crop-stitch",
  uploadCropStitch.fields([
    { name: "source", maxCount: 1 },
    { name: "mask", maxCount: 1 },
    { name: "references", maxCount: 4 }
  ]),
  async (req, res) => {
    const prompt = req.body.prompt
    const size = req.body.size || "1024x1024"
    const quality = req.body.quality || "medium"
    const padding = req.body.padding || 96

    const sourcePath = req.files?.source?.[0]?.path
    const maskPath = req.files?.mask?.[0]?.path
    const referenceUploads = req.files?.references || []

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" })
    }

    if (!sourcePath || !maskPath) {
      return res.status(400).json({ error: "Source image and mask are required" })
    }

    try {
      const sourceMeta = await sharp(sourcePath).metadata()

      const normalizedMaskPath = path.join(CROP_STITCH_DIR, `mask-normalized-${randomHash()}.png`)
      await sharp(maskPath)
        .resize(sourceMeta.width, sourceMeta.height, { fit: "fill" })
        .png()
        .toFile(normalizedMaskPath)

      const maskInfo = await getMaskInfo(normalizedMaskPath)
      if (!maskInfo) throw new Error("Mask is empty — paint the area to edit before generating.")

      const crop = buildCropAroundMask({
        bbox: maskInfo.bbox,
        sourceWidth: sourceMeta.width,
        sourceHeight: sourceMeta.height,
        padding
      })

      console.log("CROP-STITCH CROP:", crop, "MASK BBOX:", maskInfo.bbox, "REFS:", referenceUploads.length)

      const sourceCropBuffer = await sharp(sourcePath).extract(crop).png().toBuffer()
      const openAIMaskCropBuffer = await createOpenAIMaskCrop({ maskInfo, crop })

      const editImages = [
        await bufferToOpenAIFile(sourceCropBuffer, "source-crop.png", "image/png")
      ]

      for (let i = 0; i < referenceUploads.length; i++) {
        const refBuffer = await sharp(referenceUploads[i].path).png().toBuffer()
        editImages.push(await bufferToOpenAIFile(refBuffer, `reference-${i + 1}.png`, "image/png"))
      }

      const apiResult = await openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: editImages,
        mask: await bufferToOpenAIFile(openAIMaskCropBuffer, "mask-crop.png", "image/png"),
        prompt: "Edit only the transparent masked area. Preserve all unmasked image content exactly. " + prompt.trim(),
        size,
        quality
      })

      let editedCropBase64 = apiResult.data?.[0]?.b64_json
      const editedCropUrl = apiResult.data?.[0]?.url
      if (!editedCropBase64 && editedCropUrl) {
        editedCropBase64 = Buffer.from(await (await fetch(editedCropUrl)).arrayBuffer()).toString("base64")
      }
      if (!editedCropBase64) throw new Error("No edited crop returned from API")

      const maskAlphaCropped = await sharp(normalizedMaskPath)
        .extractChannel("alpha")
        .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
        .png()
        .toBuffer()

      const hardResult = await sharp(maskAlphaCropped).threshold(128).raw().toBuffer({ resolveWithObject: true })
      const softResult = await sharp(maskAlphaCropped).dilate(3).blur(14).raw().toBuffer({ resolveWithObject: true })

      const hData = hardResult.data
      const sData = softResult.data
      const hCh = hardResult.info.channels
      const sCh = softResult.info.channels
      const pixelCount = crop.width * crop.height

      // Build feathered alpha values (max of hard threshold + soft blur)
      const alphaValues = Buffer.allocUnsafe(pixelCount)
      for (let i = 0; i < pixelCount; i++) {
        alphaValues[i] = Math.max(hData[i * hCh], sData[i * sCh])
      }

      // Resize edited crop to match crop dimensions
      const editedCropResized = await sharp(Buffer.from(editedCropBase64, "base64"))
        .resize(crop.width, crop.height, { fit: "cover", position: "center" })
        .ensureAlpha()
        .raw()
        .toBuffer()

      // Assign feathered alpha directly — dest-in doesn't work reliably with grayscale masks in sharp
      for (let i = 0; i < pixelCount; i++) {
        editedCropResized[i * 4 + 3] = alphaValues[i]
      }

      const clippedEditedCrop = await sharp(editedCropResized, {
        raw: { width: crop.width, height: crop.height, channels: 4 }
      }).png().toBuffer()

      const finalBuffer = await sharp(sourcePath)
        .composite([{ input: clippedEditedCrop, left: crop.left, top: crop.top, blend: "over" }])
        .png()
        .toBuffer()

      const filename = generateFilename("gpt2e", ".png")
      fs.writeFileSync(path.join(OUTPUT_DIR, filename), finalBuffer)
      fs.writeFileSync(path.join(OUTPUT_DIR, filename.replace(".png", ".txt")), prompt.trim(), "utf-8")

      res.json({ image: finalBuffer.toString("base64"), mimeType: "image/png", filename })
    } catch (err) {
      console.error("CROP STITCH ERROR:", err)
      res.status(500).json({ error: err?.message || String(err) })
    }
  }
)

const ORDER_FILE = path.join(INPUT_DIR, "order.json")

const readInputOrder = () => {
  if (!fs.existsSync(ORDER_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(ORDER_FILE, "utf-8"))
  } catch {
    return []
  }
}

const writeInputOrder = (order) => {
  fs.writeFileSync(ORDER_FILE, JSON.stringify(order, null, 2), "utf-8")
}

const randomHash = () => crypto.randomBytes(8).toString("hex")
const generateFilename = (prefix, ext) =>
  `${prefix}-${crypto.randomBytes(16).toString("hex")}-${Date.now()}${ext}`

const getOrderedInputImages = () => {
  const existingFiles = fs
    .readdirSync(INPUT_DIR)
    .filter(file => /\.(png|jpg|jpeg|webp|gif)$/i.test(file))

  const savedOrder = readInputOrder().filter(file => existingFiles.includes(file))
  const newFiles = existingFiles.filter(file => !savedOrder.includes(file))

  return [...savedOrder, ...newFiles].map(file => path.join(INPUT_DIR, file))
}

if (!fs.existsSync(MASK_DIR)) {
  fs.mkdirSync(MASK_DIR, { recursive: true })
}

const fileToOpenAIFile = async (filePath, fallbackType = "image/png") => {
  const mimeType = mime.lookup(filePath) || fallbackType
  const buffer = fs.readFileSync(filePath)

  return await toFile(buffer, path.basename(filePath), {
    type: mimeType
  })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, INPUT_DIR)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png"
    cb(null, `nt-${randomHash()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    files: 5,
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"))
    }

    cb(null, true)
  }
})

app.get("/input-images", (req, res) => {
  try {
    const files = fs
      .readdirSync(INPUT_DIR)
      .filter(file => /\.(png|jpg|jpeg|webp|gif)$/i.test(file))

    const savedOrder = readInputOrder().filter(file => files.includes(file))
    const newFiles = files.filter(file => !savedOrder.includes(file))

    const orderedFiles = [...savedOrder, ...newFiles]
    writeInputOrder(orderedFiles)

    res.json({
      files: orderedFiles.map(file => ({
        filename: file,
        url: `/input/${file}`
      }))
    })
  } catch (err) {
    res.status(500).json({
      error: "Could not read input directory",
      details: err.message
    })
  }
})

app.post("/input-images/order", (req, res) => {
  try {
    const order = req.body.order || []

    const existingFiles = fs
      .readdirSync(INPUT_DIR)
      .filter(file => /\.(png|jpg|jpeg|webp|gif)$/i.test(file))

    const cleanOrder = order.filter(file => existingFiles.includes(file))
    const missingFiles = existingFiles.filter(file => !cleanOrder.includes(file))

    const finalOrder = [...cleanOrder, ...missingFiles]
    writeInputOrder(finalOrder)

    res.json({
      message: "Order saved",
      order: finalOrder
    })
  } catch (err) {
    res.status(500).json({
      error: "Could not save image order",
      details: err.message
    })
  }
})

app.post("/upload-reference", upload.array("images", 5), (req, res) => {
  try {
    const existingFiles = fs
      .readdirSync(INPUT_DIR)
      .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))

    const totalAfterUpload = existingFiles.length

    if (totalAfterUpload > 5) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path)
      })

      return res.status(400).json({
        error: "Upload limit exceeded",
        details: "Maximum of 5 images allowed in input directory"
      })
    }

    const files = existingFiles.map(file => ({
      filename: file,
      url: `/input/${file}`
    }))

    const order = readInputOrder()
    const uploadedNames = req.files.map(file => file.filename)
    writeInputOrder([...order, ...uploadedNames])

    return res.json({
      message: "Images uploaded successfully",
      files
    })

  } catch (err) {
    return res.status(500).json({
      error: "Upload failed",
      details: err.message
    })
  }
})

app.post("/generate", async (req, res) => {
  const prompt = req.body.prompt
  const size = req.body.size || "1024x1024"
  const quality = req.body.quality || "medium"

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" })
  }

  fs.writeFileSync(LAST_PROMPT_FILE, prompt.trim(), "utf-8")

  const referenceImages = getOrderedInputImages()

  try {
    let apiResult

    if (referenceImages.length > 0) {
      apiResult = await openai.images.edit({
        model: "gpt-image-2",
        image: await Promise.all(
          referenceImages.map(imagePath => fileToOpenAIFile(imagePath))
        ),
        prompt,
        size,
        quality
      })
    } else {
      apiResult = await openai.images.generate({
        model: "gpt-image-2",
        prompt,
        size,
        quality
      })
    }

    let imageBase64 = apiResult.data?.[0]?.b64_json
    const imageUrl = apiResult.data?.[0]?.url

    if (!imageBase64 && imageUrl) {
      const imageResponse = await fetch(imageUrl)
      imageBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString("base64")
    }

    if (!imageBase64) throw new Error("No image returned from API")

    const filename = generateFilename("gpt2i", ".png")
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), Buffer.from(imageBase64, "base64"))
    fs.writeFileSync(path.join(OUTPUT_DIR, filename.replace(".png", ".txt")), prompt.trim(), "utf-8")

    res.json({ image: imageBase64, mimeType: "image/png", filename })
  } catch (err) {
    console.error("OpenAI generation error:", err)
    res.status(500).json({ error: err?.message || String(err) })
  }
})

app.delete("/input-images/:filename", (req, res) => {
  try {
    const filename = path.basename(req.params.filename)
    const filePath = path.join(INPUT_DIR, filename)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "File not found",
        details: filename
      })
    }

    fs.unlinkSync(filePath)
    const updatedOrder = readInputOrder().filter(file => file !== filename)
    writeInputOrder(updatedOrder)

    return res.json({
      message: "Image deleted",
      filename
    })
  } catch (err) {
    return res.status(500).json({
      error: "Delete failed",
      details: err.message
    })
  }
})

app.get("/last-prompt", (req, res) => {
  try {
    if (!fs.existsSync(LAST_PROMPT_FILE)) {
      return res.json({ prompt: "" })
    }

    const prompt = fs.readFileSync(LAST_PROMPT_FILE, "utf-8")

    res.json({ prompt })
  } catch (err) {
    res.status(500).json({
      error: "Could not read last prompt",
      details: err.message
    })
  }
})

const uploadOutpaint = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MASK_DIR),
    filename: (req, file, cb) => cb(null, `${file.fieldname}-${randomHash()}.png`)
  })
})

app.post(
  "/outpaint-crop-stitch",
  uploadOutpaint.fields([
    { name: "source", maxCount: 1 },
    { name: "mask", maxCount: 1 }
  ]),
  async (req, res) => {
    const prompt = req.body.prompt
    const size = req.body.size || "1024x1024"
    const quality = req.body.quality || "medium"

    const sourcePath = req.files?.source?.[0]?.path
    const maskPath = req.files?.mask?.[0]?.path

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" })
    }

    if (!sourcePath || !maskPath) {
      return res.status(400).json({ error: "Source and mask are required" })
    }

    try {
      const sourceMeta = await sharp(sourcePath).metadata()

      const apiResult = await openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: await fileToOpenAIFile(sourcePath, "image/png"),
        mask: await fileToOpenAIFile(maskPath, "image/png"),
        prompt:
          "Extend only the transparent masked/outpaint areas. " +
          "Preserve the original visible image exactly. " +
          prompt.trim(),
        size,
        quality
      })

      let editedBase64 = apiResult.data?.[0]?.b64_json
      const editedUrl = apiResult.data?.[0]?.url
      if (!editedBase64 && editedUrl) {
        editedBase64 = Buffer.from(await (await fetch(editedUrl)).arrayBuffer()).toString("base64")
      }
      if (!editedBase64) throw new Error("No outpaint image returned from API")

      const editedBuffer = await sharp(Buffer.from(editedBase64, "base64"))
        .resize(sourceMeta.width, sourceMeta.height, { fit: "cover", position: "center" })
        .png()
        .toBuffer()

      // Outpaint area = visible, original center = transparent (invert OpenAI mask)
      const stitchMask = await sharp(maskPath)
        .resize(sourceMeta.width, sourceMeta.height, { fit: "fill" })
        .ensureAlpha()
        .extractChannel("alpha")
        .negate()
        .dilate(4)
        .blur(14)
        .png()
        .toBuffer()

      const clippedOutpaint = await sharp(editedBuffer)
        .composite([{ input: stitchMask, blend: "dest-in" }])
        .png()
        .toBuffer()

      const finalBuffer = await sharp(sourcePath)
        .composite([{ input: clippedOutpaint, left: 0, top: 0, blend: "over" }])
        .png()
        .toBuffer()

      const filename = generateFilename("gpt2e", ".png")
      fs.writeFileSync(path.join(OUTPUT_DIR, filename), finalBuffer)
      fs.writeFileSync(path.join(OUTPUT_DIR, filename.replace(".png", ".txt")), prompt.trim(), "utf-8")

      res.json({ image: finalBuffer.toString("base64"), mimeType: "image/png", filename })
    } catch (err) {
      console.error("OUTPAINT CROP-STITCH ERROR:", err)
      res.status(500).json({ error: err?.message || String(err) })
    }
  }
)

app.get("/usage-stats", async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000)
    const d = new Date()
    const monthStart = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000)

    const headers = { Authorization: `Bearer ${process.env.OPENAI_ADMIN_KEY}` }

    const costsRes = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${monthStart}&end_time=${now}&bucket_width=1d&limit=31`,
      { headers }
    )

    if (!costsRes.ok) {
      const err = await costsRes.json()
      return res.status(costsRes.status).json({ error: err?.error?.message || "Costs API error" })
    }

    const costsData = await costsRes.json()
    const dailyCosts = []

    for (const bucket of costsData.data || []) {
      const amount = bucket.results?.reduce((s, r) => s + (parseFloat(r.amount?.value) || 0), 0) || 0
      dailyCosts.push({ ts: bucket.start_time, cost: amount })
    }

    const activeDays = dailyCosts.filter(d => d.cost > 0)
    const monthCost = activeDays.reduce((s, d) => s + d.cost, 0)
    const lastDay = dailyCosts.at(-1) ?? null
    const peakDay = activeDays.reduce((best, d) => d.cost > best.cost ? d : best, { cost: 0, ts: null })
    const avgPerDay = activeDays.length > 0 ? monthCost / activeDays.length : null

    res.json({
      monthCost,
      lastDayCost: lastDay?.cost ?? null,
      lastDayTs: lastDay?.ts ?? null,
      peakDayCost: peakDay.ts ? peakDay.cost : null,
      peakDayTs: peakDay.ts ?? null,
      avgPerDay,
      dailyCosts: dailyCosts.slice(-7)
    })
  } catch (err) {
    console.error("Usage stats error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

app.post("/animate", (req, res) => {
  const { filename, prompt, duration = 6, resolution = "720p", model = "grok", seedanceFast = false } = req.body

  if (!process.env.FAL_KEY) {
    return res.status(401).json({ error: "FAL_KEY is not configured. Add FAL_KEY to your .env file to enable animation." })
  }

  if (!filename) return res.status(400).json({ error: "filename is required" })
  if (!prompt?.trim()) return res.status(400).json({ error: "prompt is required" })

  const basename = path.basename(filename)
  const sourcePath = fs.existsSync(path.join(OUTPUT_DIR, basename))
    ? path.join(OUTPUT_DIR, basename)
    : fs.existsSync(path.join(INPUT_DIR, basename))
      ? path.join(INPUT_DIR, basename)
      : null

  if (!sourcePath) {
    return res.status(404).json({ error: "Source image not found" })
  }

  const jobId = crypto.randomBytes(8).toString("hex")
  pendingJobs.set(jobId, { status: "pending" })
  res.json({ jobId })

  ;(async () => {
    try {
      const imageBuffer = await fs.promises.readFile(sourcePath)
      const imageMime = mime.lookup(sourcePath) || "image/png"
      const imageBlob = new Blob([imageBuffer], { type: imageMime })
      const imageUrl = await fal.storage.upload(imageBlob)

      let falModelId, falInput

      if (model === "seedance") {
        falModelId = seedanceFast
          ? "bytedance/seedance-2.0/fast/image-to-video"
          : "bytedance/seedance-2.0/image-to-video"
        falInput = {
          image_url: imageUrl,
          prompt: prompt.trim(),
          duration,
          resolution
        }
      } else {
        falModelId = "xai/grok-imagine-video/image-to-video"
        falInput = {
          image_url: imageUrl,
          prompt: prompt.trim(),
          duration,
          resolution,
          aspect_ratio: "auto"
        }
      }

      const result = await fal.subscribe(falModelId, { input: falInput })

      const videoUrl = result.data.video.url
      const videoRes = await fetch(videoUrl)
      if (!videoRes.ok) throw new Error("Failed to download video from fal.ai")

      const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
      const videoFilename = generateFilename(model === "seedance" ? "seed2" : "grokv", ".mp4")
      const videoPath = path.join(OUTPUT_DIR, videoFilename)
      await fs.promises.writeFile(videoPath, videoBuffer)

      pendingJobs.set(jobId, {
        status: "done",
        completedAt: Date.now(),
        result: { filename: videoFilename, mimeType: "video/mp4" }
      })
    } catch (err) {
      console.error("Animate error:", err)
      pendingJobs.set(jobId, {
        status: "error",
        completedAt: Date.now(),
        error: err?.message || String(err)
      })
    }
  })()
})

export { app, PORT }
