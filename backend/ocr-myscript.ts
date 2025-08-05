import crypto from 'crypto';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const API_ENDPOINT = process.env.MYSCRIPT_API_ENDPOINT || 'https://cloud.myscript.com/api/v4.0/iink';
const APP_KEY = process.env.MYSCRIPT_APPLICATION_KEY!;
const HMAC_KEY = process.env.MYSCRIPT_HMAC_KEY!;
const FILE_PATH = '/Users/wenhao/XLab/Calculus/homework/HW_with_Title.pdf';

if (!APP_KEY || !HMAC_KEY) {
  console.error('❌ Missing MyScript credentials.');
  process.exit(1);
}

function generateHmacSignature(method: string, path: string, timestamp: string): string {
  const payload = method + path + timestamp;
  return crypto.createHmac('sha512', HMAC_KEY).update(payload).digest('hex');
}

async function recognizeHandwriting() {
  if (!fs.existsSync(FILE_PATH)) {
    console.error(`❌ File not found: ${FILE_PATH}`);
    return;
  }

  console.log(`🚀 Uploading file to MyScript: ${FILE_PATH}`);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(FILE_PATH));
  formData.append('contentType', 'ANALYZER'); 
  formData.append('conversionState', 'DIGITAL_EDIT'); //ANALYZER 模式可以同时识别文本、数学表达式以及布局信息。

  const timestamp = new Date().toISOString();
  const path = '/api/v4.0/iink/batch';
  const signature = generateHmacSignature('POST', path, timestamp);

  try {
    const response = await axios.post(`${API_ENDPOINT}/batch`, formData, {
      headers: {
        ...formData.getHeaders(),
        'applicationKey': APP_KEY,
        'hmac': signature,
        'timestamp': timestamp
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    console.log('✅ Upload successful:', response.data);

    const jobId = response.data?.id;
    if (!jobId) throw new Error('Job ID not returned');

    console.log(`📌 Job ID: ${jobId}`);

    // 轮询任务状态
    let done = false;
    while (!done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const pollResp = await axios.get(`${API_ENDPOINT}/batch/${jobId}`, {
        headers: { 'applicationKey': APP_KEY }
      });
      const state = pollResp.data?.state;
      console.log(`⌛ Current state: ${state}`);
      if (state === 'DONE') {
        done = true;

        // 获取纯文本
        const textResp = await axios.get(`${API_ENDPOINT}/batch/${jobId}/document`, {
          headers: {
            'applicationKey': APP_KEY,
            'Accept': 'text/plain'
          }
        });
        console.log('📄 Recognized Text:\n', textResp.data);
      }
    }

  } catch (error: any) {
    console.error('❌ OCR failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

recognizeHandwriting();

// POST /api/v4.0/iink/batch
// Headers:
//   applicationKey: {APP_KEY}
//   hmac: {signature}
//   timestamp: {ISO_8601}
// Body:
//   file: (multipart PDF file)
//   contentType: TEXT
//   conversionState: DIGITAL_EDIT
