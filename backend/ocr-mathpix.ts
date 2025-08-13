// backend/ocr-mathpix.ts
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// 1) 读取 .env（多路径兜底，避免读取失败）
dotenv.config(); // 先用默认
if (!process.env.MATHPIX_APP_ID || !process.env.MATHPIX_APP_KEY) {
  const tryPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const p of tryPaths) {
    try {
      dotenv.config({ path: p });
      if (process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY) break;
    } catch { /* ignore */ }
  }
}

// 2) 环境变量
const APP_ID = process.env.MATHPIX_APP_ID || '';
const APP_KEY = process.env.MATHPIX_APP_KEY || '';

function mask(s: string) {
  if (!s) return '(empty)';
  if (s.length <= 8) return s[0] + '***' + s.slice(-1);
  return s.slice(0, 4) + '***' + s.slice(-4);
}

if (!APP_ID || !APP_KEY) {
  console.error('❌ 请先在 backend/.env 设置 MATHPIX_APP_ID 与 MATHPIX_APP_KEY');
  console.error('   示例：\n   MATHPIX_APP_ID=zju_calculus_3f7791_462ee5\n   MATHPIX_APP_KEY=xxxxxxxxxxxxxxxx');
  process.exit(1);
}

console.log(`🔑 Using APP_ID=${mask(APP_ID)}  APP_KEY=${mask(APP_KEY)}`);

const BASE = 'https://api.mathpix.com/v3';
const INPUT_PDF = process.argv[2] || '/Users/wenhao/XLab/Calculus/homework/HW_with_Title.pdf';

// 输出目录：与 PDF 同目录的 outputs-mathpix
const outDir = path.resolve(path.dirname(INPUT_PDF), 'outputs-mathpix');

// 可调参数
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000; // 20 分钟，长文档保险
const AXIOS_DEFAULTS = {
  maxContentLength: Infinity as any,
  maxBodyLength: Infinity as any,
  timeout: 60000,
  headers: {
    app_id: APP_ID,
    app_key: APP_KEY,
  },
};

async function uploadPdf(pdfPath: string): Promise<string> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`文件不存在: ${pdfPath}`);
  }
  const form = new FormData();

  // options_json: 请求完成后自动触发 docx/tex 转换；并设定 $ 作为行内公式分隔
  form.append(
    'options_json',
    JSON.stringify({
      conversion_formats: { docx: true }, // 需要 docx 就打开 true
      math_inline_delimiters: ['$', '$'],
      rm_spaces: true,
      // 按需可加: page_ranges: "1-3,5", numbers_default_to_math: true, etc.
    })
  );
  form.append('file', fs.createReadStream(pdfPath));

  console.log('📤 正在上传 PDF:', pdfPath);
  const { data } = await axios.post(`${BASE}/pdf`, form, {
    ...AXIOS_DEFAULTS,
    headers: { ...AXIOS_DEFAULTS.headers, ...form.getHeaders() },
  });

  const pdf_id = data?.pdf_id;
  if (!pdf_id) {
    console.error('⚠️ 上传响应：', data);
    throw new Error('未返回 pdf_id');
  }
  console.log('✅ 上传成功，pdf_id =', pdf_id);
  return pdf_id;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPdfCompleted(pdfId: string) {
  console.log('⏳ 等待 OCR 完成...');
  const start = Date.now();
  while (true) {
    const { data } = await axios.get(`${BASE}/pdf/${pdfId}`, { ...AXIOS_DEFAULTS });
    const status = data?.status;
    const done = data?.percent_done;
    if (status === 'completed') {
      console.log(`🎉 OCR 完成！pages=${data?.num_pages}, 进度=${done}`);
      return;
    }
    if (status === 'error') {
      throw new Error(`PDF 处理错误: ${JSON.stringify(data)}`);
    }
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error('等待超时：PDF 处理未完成');
    }
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
}

async function waitForConversions(pdfId: string) {
  console.log('\n⏳ 等待转换（docx 等）完成...');
  const start = Date.now();
  while (true) {
    const { data } = await axios.get(`${BASE}/converter/${pdfId}`, { ...AXIOS_DEFAULTS });
    const status = data?.status; // completed（存在 mmd 文档）
    const conv = data?.conversion_status || {};
    const docxStatus = conv?.docx?.status;

    if (status === 'completed' && (!conv.docx || docxStatus === 'completed')) {
      console.log('📦 转换完成（docx 就绪）');
      return;
    }
    if (docxStatus === 'error') {
      throw new Error(`DOCX 转换失败: ${JSON.stringify(conv.docx)}`);
    }
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error('等待超时：转换未完成');
    }
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
}

async function downloadText(url: string): Promise<string> {
  const { data } = await axios.get(url, { ...AXIOS_DEFAULTS, responseType: 'text' });
  return data as string;
}

async function downloadBinary(url: string): Promise<Buffer> {
  const { data } = await axios.get(url, { ...AXIOS_DEFAULTS, responseType: 'arraybuffer' });
  return Buffer.from(data);
}

async function main() {
  try {
    const pdfId = await uploadPdf(INPUT_PDF);

    // 1) 等待 OCR 完成
    await waitForPdfCompleted(pdfId);

    // 2) 等待（自动触发的）docx 转换完成
    await waitForConversions(pdfId);

    // 3) 下载 mmd、md 与 docx
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // mmd（Mathpix Markdown）
    const mmd = await downloadText(`${BASE}/pdf/${pdfId}.mmd`);
    const mmdPath = path.join(outDir, `${pdfId}.mmd`);
    fs.writeFileSync(mmdPath, mmd, 'utf8');

    // md（普通 Markdown）
    const md = await downloadText(`${BASE}/pdf/${pdfId}.md`);
    const mdPath = path.join(outDir, `${pdfId}.md`);
    fs.writeFileSync(mdPath, md, 'utf8');

    // docx（二进制）
    const docx = await downloadBinary(`${BASE}/pdf/${pdfId}.docx`);
    const docxPath = path.join(outDir, `${pdfId}.docx`);
    fs.writeFileSync(docxPath, docx);

    console.log('\n✅ 已保存结果到:');
    console.log('   -', mmdPath);
    console.log('   -', mdPath);
    console.log('   -', docxPath);
  } catch (err: any) {
    console.error('\n❌ 出错:', err?.message || err);
    if (err?.response) {
      console.error('Response:', err.response.status, err.response.statusText);
      console.error(err.response.data);
    }
    process.exit(1);
  }
}

main();
