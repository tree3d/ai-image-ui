import multer from "multer"
import express from "express"
import axios from "axios"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import FormData from "form-data"
import mime from "mime-types"
import { zhErrorMap } from "../locales/zh-errors.js"
import sharp from "sharp"
import { toFile } from "openai/uploads"
import OpenAI from "openai"
import dotenv from "dotenv"
import {
  CROP_STITCH_DIR,
  INPUT_DIR,
  LAST_PROMPT_FILE,
  MASK_DIR,
  OUTPUT_DIR
} from "./utils/paths.js"

dotenv.config()

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 5010

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
    try {
      const prompt = req.body.prompt
      const size = req.body.size || "1024x1024"
      const quality = req.body.quality || "medium"

      const sourcePath = req.files?.source?.[0]?.path
      const maskPath = req.files?.mask?.[0]?.path
      const referenceUploads = req.files?.references || []

      console.log(
        "CROP-STITCH FILES:",
        Object.keys(req.files || {})
      )

      console.log(
        "REFERENCE COUNT:",
        referenceUploads.length
      )

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required" })
      }

      if (!sourcePath || !maskPath) {
        return res.status(400).json({
          error: "Source image and mask are required"
        })
      }

      const sourceMeta = await sharp(sourcePath).metadata()

      const normalizedMaskPath = path.join(
        CROP_STITCH_DIR,
        `mask-normalized-${randomHash()}.png`
      )

      await sharp(maskPath)
        .resize(sourceMeta.width, sourceMeta.height, { fit: "fill" })
        .png()
        .toFile(normalizedMaskPath)

      const maskInfo = await getMaskInfo(normalizedMaskPath)

      if (!maskInfo) {
        return res.status(400).json({
          error: "Mask is empty",
          details: "Paint the area you want to edit before generating."
        })
      }

      const paddingX = Math.round(maskInfo.bbox.width * 0.05)
      const paddingY = Math.round(maskInfo.bbox.height * 0.05)

      const left = Math.max(0, maskInfo.bbox.x - paddingX)
      const top = Math.max(0, maskInfo.bbox.y - paddingY)

      const right = Math.min(
        sourceMeta.width,
        maskInfo.bbox.x + maskInfo.bbox.width + paddingX
      )

      const bottom = Math.min(
        sourceMeta.height,
        maskInfo.bbox.y + maskInfo.bbox.height + paddingY
      )

      const crop = {
        left,
        top,
        width: right - left,
        height: bottom - top
      }

      console.log("CROP-STITCH CROP:", crop)
      console.log("CROP-STITCH MASK BBOX:", maskInfo.bbox)

      const sourceCropBuffer = await sharp(sourcePath)
        .extract(crop)
        .png()
        .toBuffer()

      const openAIMaskCropBuffer = await createOpenAIMaskCrop({
        maskInfo,
        crop
      })

      const editImages = [
        await bufferToOpenAIFile(
          sourceCropBuffer,
          "source-crop.png",
          "image/png"
        )
      ]

      for (let i = 0; i < referenceUploads.length; i++) {
        const refBuffer = await sharp(referenceUploads[i].path)
          .png()
          .toBuffer()

        editImages.push(
          await bufferToOpenAIFile(
            refBuffer,
            `reference-${i + 1}.png`,
            "image/png"
          )
        )
      }

      console.log(
        "CROP-STITCH REFERENCES:",
        referenceUploads.length
      )

      const result = await openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: editImages,
        mask: await bufferToOpenAIFile(
          openAIMaskCropBuffer,
          "mask-crop.png",
          "image/png"
        ),
        prompt:
          "Edit only the transparent masked area. Preserve all unmasked image content exactly. " +
          prompt.trim(),
        size,
        quality
      })

      let editedCropBase64 = result.data?.[0]?.b64_json
      const editedCropUrl = result.data?.[0]?.url

      if (!editedCropBase64 && editedCropUrl) {
        const imageResponse = await fetch(editedCropUrl)
        editedCropBase64 = Buffer.from(
          await imageResponse.arrayBuffer()
        ).toString("base64")
      }

      if (!editedCropBase64) {
        return res.status(422).json({
          error: "No edited crop returned",
          details: result
        })
      }

      const rawAlphaMask = createStitchAlphaMask({
        maskInfo,
        crop
      })

      const alphaMaskPng = await sharp(rawAlphaMask, {
        raw: {
          width: crop.width,
          height: crop.height,
          channels: 1
        }
      })
        .threshold(250)
        .dilate(2)
        .blur(16)
        .png()
        .toBuffer()

      const editedCropResized = await sharp(
        Buffer.from(editedCropBase64, "base64")
      )
        .resize(crop.width, crop.height, {
          fit: "cover",
          position: "center"
        })
        .png()
        .toBuffer()

      const clippedEditedCrop = await sharp(editedCropResized)
        .composite([
          {
            input: alphaMaskPng,
            blend: "dest-in"
          }
        ])
        .png()
        .toBuffer()

      const finalBuffer = await sharp(sourcePath)
        .composite([
          {
            input: clippedEditedCrop,
            left: crop.left,
            top: crop.top,
            blend: "over"
          }
        ])
        .png()
        .toBuffer()

      const hash = randomHash()
      const filename = `nt-${hash}.png`

      fs.writeFileSync(
        path.join(OUTPUT_DIR, filename),
        finalBuffer
      )

      fs.writeFileSync(
        path.join(OUTPUT_DIR, `nt-${hash}.txt`),
        prompt.trim(),
        "utf-8"
      )

      return res.json({
        image: finalBuffer.toString("base64"),
        mimeType: "image/png",
        filename
      })
    } catch (err) {
      console.error("CROP STITCH ERROR:", err)

      return res.status(500).json({
        error: "Crop-stitch inpaint failed",
        details:
          err?.response?.data ||
          err?.error ||
          err?.message ||
          String(err)
      })
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

const maskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MASK_DIR)
  },
  filename: (req, file, cb) => {
    cb(null, `mask-${randomHash()}.png`)
  }
})

const uploadMask = multer({
  storage: maskStorage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
})

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

    // ❌ if over 5, delete the newly uploaded ones
    if (totalAfterUpload > 5) {
      // delete newest files (just uploaded)
      //req.files.forEach(file => {
      //  fs.unlinkSync(file.path)
      //})

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
  try {
    const prompt = req.body.prompt
    const size = req.body.size || "1024x1024"
    const quality = req.body.quality || "medium"

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" })
    }

    fs.writeFileSync(LAST_PROMPT_FILE, prompt.trim(), "utf-8")

    const referenceImages = getOrderedInputImages()

    let result

    if (referenceImages.length > 0) {
      result = await openai.images.edit({
        model: "gpt-image-2",
        image: await Promise.all(
          referenceImages.map(imagePath =>
            imagePathToOpenAIFile(imagePath)
          )
        ),
        prompt,
        size,
        quality
      })
    } else {
      result = await openai.images.generate({
        model: "gpt-image-2",
        prompt,
        size,
        quality
      })
    }

    let imageBase64 = result.data?.[0]?.b64_json
    const imageUrl = result.data?.[0]?.url

    if (!imageBase64 && imageUrl) {
      const imageResponse = await fetch(imageUrl)
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
      imageBase64 = imageBuffer.toString("base64")
    }

    if (!imageBase64) {
      return res.status(422).json({
        error: "No image generated",
        details: result
      })
    }

    const hash = randomHash()
    const filename = `nt-${hash}.png`
    const filePath = path.join(OUTPUT_DIR, filename)

    fs.writeFileSync(filePath, Buffer.from(imageBase64, "base64"))

    const promptFilename = `nt-${hash}.txt`
    fs.writeFileSync(
      path.join(OUTPUT_DIR, promptFilename),
      prompt.trim(),
      "utf-8"
    )

    return res.json({
      image: imageBase64,
      mimeType: "image/png",
      filename,
      promptFile: promptFilename
    })
  } catch (err) {
    console.error("OpenAI generation error:", err)

    return res.status(500).json({
      error: "Generation failed",
      details:
        err?.response?.data ||
        err?.error ||
        err?.message ||
        String(err)
    })
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
    try {
      const prompt = req.body.prompt
      const size = req.body.size || "1024x1024"
      const quality = req.body.quality || "medium"

      const sourcePath = req.files?.source?.[0]?.path
      const maskPath = req.files?.mask?.[0]?.path

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required" })
      }

      if (!sourcePath || !maskPath) {
        return res.status(400).json({
          error: "Source and mask are required"
        })
      }

      const sourceMeta = await sharp(sourcePath).metadata()

      const sourceFile = await fileToOpenAIFile(sourcePath, "image/png")
      const maskFile = await fileToOpenAIFile(maskPath, "image/png")

      const result = await openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        image: sourceFile,
        mask: maskFile,
        prompt:
          "Extend only the transparent masked/outpaint areas. " +
          "Preserve the original visible image exactly. " +
          prompt.trim(),
        size,
        quality
      })

      let editedBase64 = result.data?.[0]?.b64_json
      const editedUrl = result.data?.[0]?.url

      if (!editedBase64 && editedUrl) {
        const imageResponse = await fetch(editedUrl)
        editedBase64 = Buffer.from(
          await imageResponse.arrayBuffer()
        ).toString("base64")
      }

      if (!editedBase64) {
        return res.status(422).json({
          error: "No outpaint image returned",
          details: result
        })
      }

      const editedBuffer = await sharp(
        Buffer.from(editedBase64, "base64")
      )
        .resize(sourceMeta.width, sourceMeta.height, {
          fit: "cover",
          position: "center"
        })
        .png()
        .toBuffer()

      /**
       * OpenAI mask:
       * transparent = editable/outpaint area
       * opaque = preserved original
       *
       * For stitching we need the opposite visual alpha:
       * outpaint area = visible
       * original center = transparent
       */
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
        .composite([
          {
            input: stitchMask,
            blend: "dest-in"
          }
        ])
        .png()
        .toBuffer()

      const finalBuffer = await sharp(sourcePath)
        .composite([
          {
            input: clippedOutpaint,
            left: 0,
            top: 0,
            blend: "over"
          }
        ])
        .png()
        .toBuffer()

      const hash = randomHash()
      const filename = `nt-${hash}.png`

      fs.writeFileSync(
        path.join(OUTPUT_DIR, filename),
        finalBuffer
      )

      fs.writeFileSync(
        path.join(OUTPUT_DIR, `nt-${hash}.txt`),
        prompt.trim(),
        "utf-8"
      )

      return res.json({
        image: finalBuffer.toString("base64"),
        mimeType: "image/png",
        filename
      })
    } catch (err) {
      console.error("OUTPAINT CROP-STITCH ERROR:", err)

      return res.status(500).json({
        error: "Outpaint crop-stitch failed",
        details:
          err?.response?.data ||
          err?.error ||
          err?.message ||
          String(err)
      })
    }
  }
)

const translateChineseError = (input) => {
  if (!input) return input

  let text =
    typeof input === "string"
      ? input
      : JSON.stringify(input, null, 2)

  for (const [zh, en] of Object.entries(zhErrorMap)) {
    text = text.replaceAll(zh, en)
  }

  return text
}

const imagePathToOpenAIFile = async (imagePath) => {
  const mimeType = mime.lookup(imagePath) || "image/png"
  const filename = path.basename(imagePath)

  const buffer = fs.readFileSync(imagePath)

  return await toFile(buffer, filename, {
    type: mimeType
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
