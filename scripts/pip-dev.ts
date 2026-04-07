import { spawnSync } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';

const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';
const TEMP_FILE = path.join(process.cwd(), 'get-pip.py');

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const pyPath = process.env.PYTHON_EXECUTABLE || 'python3';
  console.log(`--- Installing pip for ${pyPath} ---`);

  try {
    console.log(`Downloading get-pip.py from ${GET_PIP_URL}...`);
    await downloadFile(GET_PIP_URL, TEMP_FILE);

    console.log('Running get-pip.py...');
    const result = spawnSync(pyPath, [TEMP_FILE, '--user'], { stdio: 'inherit' });

    if (result.status === 0) {
      console.log('pip installed successfully.');
    } else {
      console.error(`Failed to install pip. Exit code: ${result.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during pip installation:', error);
    process.exit(1);
  } finally {
    if (fs.existsSync(TEMP_FILE)) {
      fs.unlinkSync(TEMP_FILE);
    }
  }
}

main();
