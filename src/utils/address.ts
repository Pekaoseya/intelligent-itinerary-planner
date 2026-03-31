/**
 * 地址简化工具
 * 从完整地址中提取关键信息（建筑名/小区名/路名）
 */

/**
 * 地址简化配置
 */
interface AddressSimplifyConfig {
  /** 建筑关键词 */
  buildingKeywords: string[]
  /** 小区关键词 */
  communityKeywords: string[]
  /** 最大提取长度 */
  maxExtractLength: number
  /** 最小提取长度 */
  minExtractLength: number
}

const DEFAULT_CONFIG: AddressSimplifyConfig = {
  buildingKeywords: ['园区', '大厦', '大楼', '中心', '广场', '城', '小区', '花园', '公寓', '苑', '村'],
  communityKeywords: ['小区', '村', '花园', '苑', '公寓'],
  maxExtractLength: 8,
  minExtractLength: 2,
}

/**
 * 判断是否为行政区划的"区"
 * 规则：
 * 1. "新区"、"开发区" 等特殊行政区
 * 2. 区名通常是 2-3 个字 + "区"
 */
function isDistrictDivision(address: string, districtIndex: number): boolean {
  // 检查是否是"新区"、"开发区"等
  if (districtIndex >= 1 && address[districtIndex - 1] === '新') {
    return true
  }
  if (districtIndex >= 2 && address.substring(districtIndex - 2, districtIndex) === '开发') {
    return true
  }

  // 检查前面是否是行政区划特征
  // 行政区划通常是：XX区、XXX区（如西湖区、江干区、朝阳区）
  // 而建筑名中的"区"通常是：X区（如西区、东区、一区）
  if (districtIndex >= 2) {
    const beforeDistrict = address.substring(districtIndex - 2, districtIndex)
    // 行政区划通常是完整词语，建筑分区通常是单字+区
    // 如果"区"前面是2个字，检查是否是常见的行政区划后缀
    const districtSuffixes = ['山', '湖', '江', '海', '城', '源', '阳', '阴', '宁', '安', '平', '乐']
    // 如果前两个字中包含这些字，很可能是行政区划
    if (districtSuffixes.some(suffix => beforeDistrict.includes(suffix))) {
      return true
    }
  }

  return false
}

/**
 * 从地址中提取名称（向前搜索）
 */
function extractNameBackward(
  address: string,
  keywordIndex: number,
  keyword: string,
  config: AddressSimplifyConfig
): string | null {
  let start = keywordIndex - 1
  let charCount = 0

  while (start >= 0 && charCount < config.maxExtractLength) {
    const ch = address[start]

    // 门牌号停止
    if (ch === '号') break

    // 省市县停止
    if (/[省市县]/.test(ch)) break

    // 区级行政区划停止
    if (ch === '区' && isDistrictDivision(address, start)) {
      break
    }

    start--
    charCount++
  }

  const name = address.substring(start + 1, keywordIndex + keyword.length)
  
  if (name.length >= config.minExtractLength && name.length <= config.maxExtractLength) {
    return name
  }

  return null
}

/**
 * 从地址中提取小区/村名（含分区信息）
 */
function extractCommunityName(
  address: string,
  keyword: string,
  config: AddressSimplifyConfig
): string | null {
  const idx = address.lastIndexOf(keyword)
  if (idx <= 0) return null

  // 向前提取
  let start = idx - 1
  let charCount = 0

  while (start >= 0 && charCount < 4) {
    const ch = address[start]
    if (/[省市县区街道]/.test(ch) || ch === '村') {
      break
    }
    start--
    charCount++
  }

  // 向后提取分区（如"西区"、"一区"）
  let end = idx + keyword.length
  const remaining = address.substring(end)
  const areaMatch = remaining.match(/^([东西南北一二三四五六七八九十]+区?)/)
  if (areaMatch) {
    end += areaMatch[1].length
  }

  const name = address.substring(start + 1, end)

  if (name.length >= config.minExtractLength && name.length <= config.maxExtractLength) {
    return name
  }

  return null
}

/**
 * 从地址中提取路名
 */
function extractRoadName(address: string): string | null {
  const roadIdx = address.lastIndexOf('路')
  if (roadIdx <= 0) return null

  let start = roadIdx - 1
  while (start >= 0 && roadIdx - start <= 4 && !/[省市县区街道]/.test(address[start])) {
    start--
  }

  const roadName = address.substring(start + 1, roadIdx + 1)
  if (roadName.length >= 2) {
    return roadName
  }

  return null
}

/**
 * 从地址中提取街道名
 */
function extractStreetName(address: string): string | null {
  const streetMatch = address.match(/([\u4e00-\u9fa5]{2}街道)/)
  return streetMatch ? streetMatch[1] : null
}

/**
 * 简化地址，提取关键信息
 * 优先级：建筑名 > 小区/村名 > 路名 > 街道
 * 
 * @param address 完整地址
 * @param config 配置项（可选）
 * @returns 简化后的地址
 * 
 * @example
 * simplifyAddress('浙江省杭州市滨江区网商路599号阿里巴巴园区')
 * // => '阿里巴巴园区'
 * 
 * simplifyAddress('浙江省杭州市西湖区翠苑街道九莲新村西区')
 * // => '九莲新村西区'
 */
export function simplifyAddress(
  address: string,
  config: Partial<AddressSimplifyConfig> = {}
): string {
  if (!address) return ''

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  // 去除括号内容
  const cleanAddress = address.replace(/\([^)]*\)/g, '')

  // 1. 优先提取建筑名
  for (const kw of mergedConfig.buildingKeywords) {
    // 跳过小区关键词，后面单独处理
    if (mergedConfig.communityKeywords.includes(kw)) continue

    const idx = cleanAddress.lastIndexOf(kw)
    if (idx > 0) {
      const name = extractNameBackward(cleanAddress, idx, kw, mergedConfig)
      if (name) return name
    }
  }

  // 2. 提取小区/村名（含分区）
  for (const kw of mergedConfig.communityKeywords) {
    const name = extractCommunityName(cleanAddress, kw, mergedConfig)
    if (name) return name
  }

  // 3. 提取路名
  const roadName = extractRoadName(cleanAddress)
  if (roadName) return roadName

  // 4. 提取街道
  const streetName = extractStreetName(cleanAddress)
  if (streetName) return streetName

  // 兜底：返回最后10个字符
  return address.slice(-10)
}
