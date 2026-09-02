const { deflateSync } = require('node:zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createPng(width, height, options = {}) {
  const colorType = options.colorType ?? 2;
  const channelsByColorType = new Map([
    [0, 1],
    [2, 3],
    [3, 1],
    [4, 2],
    [6, 4]
  ]);
  const channels = channelsByColorType.get(colorType);
  if (!channels) {
    throw new RangeError(`Unsupported fixture color type: ${colorType}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = width * channels;
  const pixels = Buffer.alloc((rowLength + 1) * height);
  const chunks = [createChunk('IHDR', ihdr)];
  if (options.transparentChunk) {
    chunks.push(createChunk('tRNS', Buffer.alloc(colorType === 2 ? 6 : 2)));
  }
  chunks.push(createChunk('IDAT', deflateSync(pixels)));
  chunks.push(createChunk('IEND'));

  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

module.exports = { createPng, PNG_SIGNATURE };
