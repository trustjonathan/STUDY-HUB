import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = process.argv[2] || 'resources'
const FOLDER_PATH = process.argv[3] || './resources'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function batchUpload() {
  if (!fs.existsSync(FOLDER_PATH)) {
    console.error(`Folder not found: ${FOLDER_PATH}`)
    process.exit(1)
  }

  const files = fs.readdirSync(FOLDER_PATH)

  for (const file of files) {
    const filePath = path.join(FOLDER_PATH, file)
    if (fs.statSync(filePath).isDirectory()) continue

    const fileBuffer = fs.readFileSync(filePath)
    console.log(`Uploading ${file}...`)

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`documents/${file}`, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (error) console.error(`Error uploading ${file}:`, error.message)
    else console.log(`Uploaded successfully: ${data.path}`)
  }
}

batchUpload()
