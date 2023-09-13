import { randomUUID } from 'crypto'
import express, { ErrorRequestHandler } from 'express'
import formidable from 'formidable'
import { mkdirSync } from 'fs'
import { print } from 'listening-on'
import { array, float, object, string } from 'cast.ts'
import { proxy } from './proxy'
import { FaceMatcher, LabeledFaceDescriptors } from '@vladmandic/face-api'
import { HttpError } from './http.error'
import httpStatus from 'http-status'

let app = express()

app.use(express.static('public'))
app.use('/face-api', express.static('node_modules/@vladmandic/face-api'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

let facePicUploadDir = 'uploads/face-pics'
mkdirSync(facePicUploadDir, { recursive: true })

let registerParser = object({
  fields: object({
    width: array(float()),
    height: array(float()),
    descriptor: array(string()),
    nickname: array(string({ nonEmpty: true, trim: true })),
  }),
  files: object({
    image: array(object({ newFilename: string() })),
  }),
})

app.post('/register', async (req, res, next) => {
  try {
    let form = formidable({
      uploadDir: facePicUploadDir,
      filename(name, ext, part, form) {
        return randomUUID() + '.webp'
      },
      filter(part) {
        return part.mimetype?.startsWith('image/webp') || false
      },
    })
    let [fields, files] = await form.parse(req)
    let input = registerParser.parse({ fields, files })

    let queryDescriptor = parseFloat32Array(input.fields.descriptor[0])
    let match = matchUser(queryDescriptor)

    if (match.label != 'unknown') {
      throw new HttpError(httpStatus.CONFLICT, 'You have already registered')
    }

    let user_id = proxy.user.push({
      nickname: input.fields.nickname[0],
    })
    let face_id = proxy.face.push({
      user_id,
      width: input.fields.width[0],
      height: input.fields.height[0],
      descriptor: input.fields.descriptor[0],
      filename: input.files.image[0].newFilename,
    })
    res.json({ user_id, face_id })
  } catch (error) {
    next(error)
  }
})

let loginParser = object({
  body: object({
    width: float(),
    height: float(),
    descriptor: string(),
  }),
})

app.post('/login', async (req, res, next) => {
  try {
    let input = loginParser.parse(req)
    let queryDescriptor = parseFloat32Array(input.body.descriptor)
    let match = matchUser(queryDescriptor)
    console.log('login match:', match)
    if (match.label == 'unknown') {
      throw new HttpError(httpStatus.UNAUTHORIZED, 'no face matched')
    }
    let user_id = +match.label
    let user = proxy.user[user_id]
    proxy.face.push({
      user_id,
      width: input.body.width,
      height: input.body.height,
      descriptor: input.body.descriptor,
      filename: 'none',
    })
    res.json({
      user_id,
      nickname: user.nickname,
    })
  } catch (error) {
    next(error)
  }
})

let distanceThreshold = 0.2

function matchUser(queryDescriptor: Float32Array) {
  let inputs = proxy.face.map(face => {
    let descriptor = parseFloat32Array(face.descriptor)
    let label = String(face.user_id)
    return new LabeledFaceDescriptors(label, [descriptor])
  })
  let faceMatcher = new FaceMatcher(inputs, distanceThreshold)
  let faceMatch = faceMatcher.findBestMatch(queryDescriptor)
  return faceMatch
}

function parseFloat32Array(text: string): Float32Array {
  return new Float32Array(text.split(',').map(s => +s))
}

app.use((req, res, next) =>
  next(
    new HttpError(
      404,
      `route not found, method: ${req.method}, url: ${req.url}`,
    ),
  ),
)

let errorHandler: ErrorRequestHandler = (err: HttpError, req, res, next) => {
  if (!err.statusCode) console.error(err)
  res.status(err.statusCode || 500)
  let error = String(err).replace(/^(\w*)Error: /, '')
  if (req.headers.accept?.includes('application/json')) {
    res.json({ error })
  } else {
    res.end(error)
  }
}
app.use(errorHandler)

let port = 8100
app.listen(port, () => {
  print(port)
})
