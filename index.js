const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOTAL_REQUESTS = 10;
const DEFAULT_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTn2v0-k2SEMgX0sjrPf_bpnm44Lfx9IHYgt_1Juzecng&s=10';

// Конфигурация приложения
const config = {
  requests: TOTAL_REQUESTS,
  url: DEFAULT_URL,
  bufferSize: 1024 * 1024,
  output: 'console',
  saveFiles: true
};

const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg.startsWith('--requests=')) {
    config.requests = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--url=')) {
    config.url = arg.split('=')[1];
  } else if (arg.startsWith('--buffer-size=')) {
    config.bufferSize = parseInt(arg.split('=')[1]);
  } else if (arg === '--output=json') {
    config.output = 'json';
  } else if (arg === '--output=file') {
    config.output = 'file';
  } else if (arg === '--save-files') {
    config.saveFiles = true;
  }
});

function logResult(result) {
  if (config.output === 'file') {
    fs.writeFileSync('output.txt', JSON.stringify(result));
  } else {
    console.log(`
Среднее время запроса: ${result.averageTime.toFixed(2)} мс
Общий объем загруженных данных: ${result.totalMegabytes.toFixed(2)} МБ
Скорость скачивания: ${result.downloadSpeed.toFixed(2)} МБ/с
`);
  }
}

async function measureInternetSpeed() {

  let totalTime = 0;
  let totalBytes = 0;

  try {
    await axios.head(config.url);
  } catch (error) {
    console.error(`Ошибка проверки доступности URL: ${error.message}`);
    return;
  }

  for (let i = 0; i < config.requests; i++) {
    const startTime = performance.now();

    try {
      const response = await axios({
        method: 'get',
        url: config.url,
        responseType: 'arraybuffer',
        maxContentLength: config.bufferSize,
        maxBodyLength: config.bufferSize
      });

      const elapsedTime = performance.now() - startTime;
      totalTime += elapsedTime;
      totalBytes += response.data.length;

      if (config.saveFiles) {
        fs.writeFileSync(`response-${i}.bin`, Buffer.from(response.data));
      }

      console.log(`Запрос ${i+1}: Время загрузки - ${elapsedTime} мс`);
    } catch (error) {
      console.error(`Ошибка при выполнении запроса ${i+1}: ${error.message}`);
    }
  }

  const averageTime = totalTime / config.requests;
  const totalMegabytes = totalBytes / (1024 * 1024);
  const downloadSpeed = (totalMegabytes * 1000) / (totalTime / 1000);

  logResult({
    averageTime,
    totalMegabytes,
    downloadSpeed
  });
}

measureInternetSpeed();

process.on('exit', () => {
  if (!config.saveFiles) {
    for (let i = 0; i < config.requests; i++) {
      const filePath = path.join(process.cwd(), `response-${i}.bin`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

if (process.argv.includes('--help')) {
  console.log(`
Использование: node index.js [опции]

Опции:
  --requests=N         Количество запросов (по умолчанию 10)
  --url=URL            URL для тестирования (по умолчанию тяжёлый ресурс)
  --buffer-size=N      Размер буфера в байтах (по умолчанию 1MB)
  --output=json      Вывод в JSON формате
  --output=file       Вывод в файл output.txt
  --save-files        Сохранять загруженные файлы
  --help              Показать эту помощь
`);
  process.exit(0);
}