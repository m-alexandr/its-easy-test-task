import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const TOTAL_REQUESTS = 10;
const DEFAULT_URL =
    'https://raw.githubusercontent.com/m-alexandr/its-easy-test-task/refs/heads/main/painting-mountain-lake-with-mountain-background.jpg';

const config = {
  requests: TOTAL_REQUESTS,
  url: DEFAULT_URL,
  bufferSize: 1024 * 1024,
  output: 'console',
  saveFiles: false,
};

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--requests=')) {
    config.requests = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--url=')) {
    config.url = arg.split('=')[1];
  } else if (arg.startsWith('--buffer-size=')) {
    config.bufferSize = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--output=json') {
    config.output = 'json';
  } else if (arg === '--output=file') {
    config.output = 'file';
  } else if (arg === '--save-files') {
    config.saveFiles = true;
  } else if (arg === '--help') {
    console.log(`
Использование: node index.js [опции]

Опции:
  --requests=N       Количество запросов (по умолчанию 10)
  --url=URL          URL для тестирования
  --buffer-size=N    Размер буфера в байтах (по умолчанию 1 МиБ)
  --output=json      Вывод в JSON
  --output=file      Вывод в файл output.txt
  --save-files       Сохранять загруженные файлы
  --help             Показать эту помощь
`);
    process.exit(0);
  }
}

function logResult(result) {
  if (config.output === 'file') {
    fs.writeFileSync('output.txt', JSON.stringify(result, null, 2));
    console.log('Результат записан в output.txt');
  } else if (config.output === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`
Среднее время запроса:       ${result.averageTime.toFixed(2)} мс
Общий объём данных:          ${result.totalMegabytes.toFixed(2)} МиБ
Скорость скачивания:         ${result.downloadSpeed.toFixed(2)} МиБ/с
`);
  }
}

function downloadOnce(url, saveTo, bufferSize) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();

    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let bytes = 0;
      let out = null;

      if (saveTo) {
        out = fs.createWriteStream(saveTo, { highWaterMark: bufferSize });
        out.on('error', reject);
      }

      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (out) out.write(chunk);
      });

      res.on('error', reject);

      res.on('end', () => {
        const elapsedTime = performance.now() - startTime;
        if (out) {
          out.end(() => resolve({ bytes, elapsedTime }));
        } else {
          resolve({ bytes, elapsedTime });
        }
      });
    });

    req.on('error', reject);
  });
}

async function measureInternetSpeed() {
  let totalTime = 0;
  let totalBytes = 0;

  for (let i = 0; i < config.requests; i++) {
    const saveTo = config.saveFiles
        ? path.join(process.cwd(), `response-${i}.bin`)
        : null;

    try {
      const { bytes, elapsedTime } = await downloadOnce(
          config.url,
          saveTo,
          config.bufferSize,
      );

      totalTime += elapsedTime;
      totalBytes += bytes;

      console.log(
          `Запрос ${i + 1}: ${elapsedTime.toFixed(2)} мс, ` +
          `${(bytes / (1024 * 1024)).toFixed(2)} МиБ` +
          (saveTo ? ` → ${path.basename(saveTo)}` : ''),
      );
    } catch (error) {
      console.error(`Ошибка при выполнении запроса ${i + 1}: ${error.message}`);
      process.exit(1);
    }
  }

  const averageTime = totalTime / config.requests;
  const totalMegabytes = totalBytes / (1024 * 1024);
  const downloadSpeed = totalTime > 0 ? totalMegabytes / (totalTime / 1000) : 0;

  logResult({ averageTime, totalMegabytes, downloadSpeed });
}

process.on('unhandledRejection', (reason) =>
    console.error('Unhandled Rejection:', reason),
);
process.on('uncaughtException', (err) =>
    console.error('Uncaught Exception:', err),
);

await measureInternetSpeed();