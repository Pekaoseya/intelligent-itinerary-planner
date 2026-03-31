/**
 * 纯 JavaScript UTF-8 解码器
 * 
 * 兼容真机小程序环境（不支持 TextDecoder）
 * 支持 1-4 字节 UTF-8 字符
 */

// 存储跨 chunk 的不完整字节
const incompleteBuffers = new Map<string, Uint8Array>()

/**
 * 纯 JavaScript 实现 UTF-8 解码
 * 将 Uint8Array 转换为字符串
 */
export function utf8ArrayToString(uint8Array: Uint8Array): string {
  let result = ''
  let i = 0
  
  while (i < uint8Array.length) {
    const byte1 = uint8Array[i++]
    
    if (byte1 === undefined) break
    
    if (byte1 < 0x80) {
      // 单字节 ASCII (0xxxxxxx)
      result += String.fromCharCode(byte1)
    } else if (byte1 >= 0xC0 && byte1 < 0xE0) {
      // 2 字节字符 (110xxxxx 10xxxxxx)
      const byte2 = uint8Array[i++]
      if (byte2 === undefined) break
      const codePoint = ((byte1 & 0x1F) << 6) | (byte2 & 0x3F)
      result += String.fromCharCode(codePoint)
    } else if (byte1 >= 0xE0 && byte1 < 0xF0) {
      // 3 字节字符 (1110xxxx 10xxxxxx 10xxxxxx) - 中文通常是这个
      const byte2 = uint8Array[i++]
      const byte3 = uint8Array[i++]
      if (byte2 === undefined || byte3 === undefined) break
      const codePoint = ((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F)
      result += String.fromCharCode(codePoint)
    } else if (byte1 >= 0xF0 && byte1 < 0xF8) {
      // 4 字节字符 (11110xxx 10xxxxxx 10xxxxxx 10xxxxxx)
      const byte2 = uint8Array[i++]
      const byte3 = uint8Array[i++]
      const byte4 = uint8Array[i++]
      if (byte2 === undefined || byte3 === undefined || byte4 === undefined) break
      // 4 字节 UTF-8 需要转换为 UTF-16 代理对
      const codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F)
      const surrogateCodePoint = codePoint - 0x10000
      const highSurrogate = 0xD800 + (surrogateCodePoint >> 10)
      const lowSurrogate = 0xDC00 + (surrogateCodePoint & 0x3FF)
      result += String.fromCharCode(highSurrogate, lowSurrogate)
    } else if ((byte1 & 0xC0) === 0x80) {
      // 延续字节 (10xxxxxx)，不应该出现在字符开头，跳过
      continue
    }
  }
  
  return result
}

/**
 * 找到完整的 UTF-8 字符边界
 * 返回最后一个完整字符的结束位置
 */
export function findValidUTF8Boundary(buffer: Uint8Array): number {
  if (buffer.length === 0) return 0
  
  // 从末尾向前找，跳过延续字节 (10xxxxxx)
  let i = buffer.length - 1
  while (i >= 0 && (buffer[i] & 0xC0) === 0x80) {
    i--
  }
  
  if (i < 0) return 0
  
  const firstByte = buffer[i]
  let charLen: number
  
  if ((firstByte & 0x80) === 0x00) {
    // 单字节 ASCII
    charLen = 1
  } else if ((firstByte & 0xE0) === 0xC0) {
    // 2 字节字符
    charLen = 2
  } else if ((firstByte & 0xF0) === 0xE0) {
    // 3 字节字符
    charLen = 3
  } else if ((firstByte & 0xF8) === 0xF0) {
    // 4 字节字符
    charLen = 4
  } else {
    // 无效字节
    return i
  }
  
  // 检查字符是否完整
  const remaining = buffer.length - i
  if (remaining < charLen) {
    return i  // 不完整，返回边界
  }
  
  return buffer.length
}

/**
 * 解码 ArrayBuffer 到字符串
 * 自动处理跨 chunk 的不完整 UTF-8 字符
 * 
 * @param buffer - 新收到的二进制数据
 * @param uid - 请求唯一标识，用于缓存不完整数据
 * @returns 解码后的字符串
 */
export function decodeChunk(buffer: ArrayBuffer, uid: string): string {
  const newBytes = new Uint8Array(buffer)
  
  // 获取上次剩余的不完整数据
  let combined: Uint8Array
  if (incompleteBuffers.has(uid)) {
    const remaining = incompleteBuffers.get(uid)!
    combined = new Uint8Array(remaining.length + newBytes.length)
    combined.set(remaining, 0)
    combined.set(newBytes, remaining.length)
    incompleteBuffers.delete(uid)
  } else {
    combined = newBytes
  }
  
  // 找到完整的字符边界
  const validEnd = findValidUTF8Boundary(combined)
  
  if (validEnd === 0) {
    // 没有完整字符，全部保留等待下次
    incompleteBuffers.set(uid, combined)
    return ''
  }
  
  // 解码完整的部分
  const toDecode = combined.slice(0, validEnd)
  const text = utf8ArrayToString(toDecode)
  
  // 保留不完整的部分
  if (validEnd < combined.length) {
    incompleteBuffers.set(uid, combined.slice(validEnd))
  }
  
  return text
}

/**
 * 清理指定请求的不完整数据缓存
 */
export function clearIncompleteBuffer(uid: string): void {
  incompleteBuffers.delete(uid)
}

/**
 * 清理所有不完整数据缓存
 */
export function clearAllIncompleteBuffers(): void {
  incompleteBuffers.clear()
}
