import path from "path"
import { fileURLToPath } from "url"

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = path.resolve(SERVER_DIR, "..", "..")

export const CROP_STITCH_DIR = path.join(ROOT_DIR, "crop-stitch")
export const INPUT_DIR = path.join(ROOT_DIR, "input")
export const MASK_DIR = path.join(ROOT_DIR, "mask")
export const OUTPUT_DIR = path.join(ROOT_DIR, "output")
