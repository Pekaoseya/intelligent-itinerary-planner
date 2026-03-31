/**
 * 地址简化工具
 * 
 * 设计原则（参考 MGeo 地址处理最佳实践）：
 * 1. 语义完整性：不截断到词语中间（如"下沙街道"不能截成"下沙街"）
 * 2. 信息密度优先：优先保留高价值信息（建筑名 > 路名 > 行政区）
 * 3. 动态长度控制：目标10字符，但允许适当扩展
 * 4. 尾部完整性检测：如果距离地址末尾很近，就完整显示
 */

/**
 * 语义单元结束标记
 * 格式：标记 -> 该标记允许的最小名称长度
 */
const END_MARKERS = new Map([
  // 建筑类（优先级最高）
  ['大厦', 2], ['大楼', 2], ['中心', 2], ['广场', 2], ['园区', 2], ['城', 2],
  // 小区类
  ['小区', 2], ['花园', 2], ['公寓', 2], ['苑', 2], ['村', 2],
  // 道路类
  ['大街', 2], ['大道', 2], ['路', 2], ['街', 2], ['巷', 1], ['弄', 1],
  // 行政类
  ['街道', 2], ['镇', 2], ['乡', 2], ['开发区', 2], ['新区', 2], ['区', 1], ['县', 1], ['市', 1], ['省', 1],
  // 门牌类
  ['号楼', 1], ['栋', 1], ['座', 1], ['层', 1], ['号', 1], ['室', 1],
])

/**
 * 检查某个位置是否是语义单元的结束
 */
function findSemanticEnd(address: string, pos: number): { isEnd: boolean; marker?: string; nameLen?: number; unitStart?: number } {
  for (const [marker, minName] of END_MARKERS) {
    const markerStart = pos - marker.length
    if (markerStart >= 0 && address.substring(markerStart, pos) === marker) {
      // 找到了标记，向前检查名称长度
      let nameLen = 0
      let i = markerStart - 1
      while (i >= 0 && nameLen < 6) {
        const ch = address[i]
        if (!/[\u4e00-\u9fa50-9A-Za-z]/.test(ch)) break
        nameLen++
        i--
      }
      
      if (nameLen >= minName) {
        return { isEnd: true, marker, nameLen, unitStart: i + 1 }
      }
    }
  }
  return { isEnd: false }
}

/**
 * 找到地址中所有有效的截断点（语义单元的结束位置）
 */
function findValidCutPoints(address: string): Array<{ position: number; unitStart: number; marker: string }> {
  const points: Array<{ position: number; unitStart: number; marker: string }> = []
  
  for (let i = address.length; i > 0; i--) {
    const result = findSemanticEnd(address, i)
    if (result.isEnd && result.marker && result.unitStart !== undefined) {
      points.push({
        position: i,
        unitStart: result.unitStart,
        marker: result.marker,
      })
    }
  }
  
  return points.sort((a, b) => b.position - a.position)
}

/**
 * 智能地址简称生成
 * 
 * 核心算法：
 * 1. 找到所有语义边界点
 * 2. 从末尾开始，逐步向前尝试
 * 3. 检查：当前长度 + 距离末尾的距离 <= maxLen + 缓冲
 * 4. 如果满足条件，就包含这个语义单元
 * 
 * @param address 完整地址
 * @param maxLen 目标最大长度（默认10）
 * @returns 简化后的地址
 */
export function smartSimplifyAddress(address: string, maxLen: number = 10): string {
  if (!address || address.length <= maxLen) return address || ''
  
  const cleanAddress = address.replace(/\s+/g, '').replace(/[（）()【】\[\]]/g, '')
  
  if (cleanAddress.length <= maxLen) return cleanAddress
  
  // 找到所有有效截断点
  const cutPoints = findValidCutPoints(cleanAddress)
  
  if (cutPoints.length === 0) {
    return cleanAddress.slice(-maxLen)
  }
  
  // 从后向前选择截断点
  for (const point of cutPoints) {
    const length = point.position
    const remainingStart = point.unitStart
    
    // 核心判断：
    // 1. 如果截断点到末尾的长度 <= maxLen，可以用
    // 2. 如果截断点到末尾的长度 + 前面剩余字符 <= maxLen + 2，也用
    
    if (length <= maxLen) {
      // 检查前面是否还有少量字符（<=2个字）
      if (remainingStart > 0 && remainingStart <= 2 && length + remainingStart <= maxLen + 1) {
        return cleanAddress.substring(0, point.position)
      }
      return cleanAddress.substring(0, point.position)
    }
    
    // 检查这个语义单元本身是否可以作为结果
    const unitLen = point.position - point.unitStart
    if (unitLen <= maxLen) {
      // 还需要检查末尾是否有剩余
      const remainingEnd = cleanAddress.length - point.position
      if (remainingEnd <= 2 && unitLen + remainingEnd <= maxLen + 1) {
        return cleanAddress.substring(point.unitStart)
      }
    }
  }
  
  // 没找到合适的，返回最后一个语义单元
  const lastPoint = cutPoints[cutPoints.length - 1]
  return cleanAddress.substring(lastPoint.unitStart)
}

/**
 * 简化地址，提取关键信息（兼容旧接口）
 * 
 * @param address 完整地址
 * @returns 简化后的地址
 */
export function simplifyAddress(
  address: string,
  _config?: Record<string, unknown>
): string {
  return smartSimplifyAddress(address, 10)
}
