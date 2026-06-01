const ModbusRTU = require("modbus-serial");

/**
 * Parsers for different data types from Modbus buffers.
 */
const Parsers = {
  long: (buffer, offset) => {
    const high = buffer.readUInt16BE(offset);
    const low = buffer.readUInt16BE(offset + 2);
    const combined = high * 0x10000 + low;
    return combined > 0x7fffffff ? combined - 0x100000000 : combined;
  },
  ulong: (buffer, offset) => {
    const high = buffer.readUInt16BE(offset);
    const low = buffer.readUInt16BE(offset + 2);
    return high * 0x10000 + low;
  },
  long_swap: (buffer, offset) => {
    const low = buffer.readUInt16BE(offset);
    const high = buffer.readUInt16BE(offset + 2);
    const combined = high * 0x10000 + low;
    return combined > 0x7fffffff ? combined - 0x100000000 : combined;
  },
  int16: (buffer, offset) => buffer.readInt16BE(offset),
  uint16: (buffer, offset) => buffer.readUInt16BE(offset),
};

/**
 * utility to handle safe Modbus reading and parsing.
 */
class ModbusReader {
  /**
   * @param {ModbusRTU} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Reads a value based on a configuration object.
   * @param {Object} config - { address, length, type, kv, scale, ... }
   * @param {Object} context - Context for relative values (e.g. nominal voltage)
   * @returns {Promise<number|null>}
   */
  async readValue(config, context = {}) {
    if (!config || !config.address) return null;

    const length = config.length || 2;
    try {
      const data = await this.client.readInputRegisters(config.address, length);
      return this.parseBuffer(data.buffer, config);
    } catch (error) {
      // Re-throw or return null depending on strategy. Here we return null to allow partial reads.
      return null;
    }
  }

  parseBuffer(buffer, config) {
    let val = 0;
    const type = config.type || "long";

    // 16-bit
    if (config.length === 1) {
      if (buffer.length < 2) return 0;
      val =
        type === "ulong" || type === "uint"
          ? Parsers.uint16(buffer, 0)
          : Parsers.int16(buffer, 0);
    }
    // 32-bit
    else {
      if (buffer.length < 4) return 0;
      if (type === "long_swap") val = Parsers.long_swap(buffer, 0);
      else if (type === "ulong" || type === "uint")
        val = Parsers.ulong(buffer, 0);
      else val = Parsers.long(buffer, 0);
    }

    return val;
  }

  /**
   * Reads a block of registers and parses multiple values (e.g. 3 phases).
   * @param {Object} config - { address, length, type, scale, kv ... }
   * @param {number} count - Number of items to read (e.g. 3 for L1, L2, L3)
   * @returns {Promise<number[]>}
   */
  async readBlock(config, count = 3) {
    if (!config || !config.address) return Array(count).fill(0);

    try {
      const data = await this.client.readInputRegisters(
        config.address,
        config.length,
      );
      const values = [];
      const step = (config.length / count) * 2; // bytes per item

      for (let i = 0; i < count; i++) {
        const offset = i * step;
        if (offset + step > data.buffer.length) break;

        // Create a sub-buffer/slice logic conceptually, but we can just pass offset to parsers
        // parsers above take offset, but we need to adapt them or just pass slices
        // Let's adapt parsers to take buffer and offset, oh wait they do.

        // We need to determine specific parser logic here based on type again
        // Or reuse parseBuffer logic but we need to pass a slice effectively

        // Helper for slice
        const slice = data.buffer.slice(offset, offset + step);
        // Fake config for single item
        const itemConfig = { ...config, length: step / 2 };
        values.push(this.parseBuffer(slice, itemConfig));
      }
      return values;
    } catch (e) {
      return Array(count).fill(0);
    }
  }
}

function applyScaling(value, config, contextBase = 1) {
  if (value === undefined || value === null) return 0;

  if (config.scale) {
    return value * config.scale;
  }

  if (config.kv) {
    return value * (contextBase / config.kv);
  }

  return value;
}

module.exports = {
  Parsers,
  ModbusReader,
  applyScaling,
};
