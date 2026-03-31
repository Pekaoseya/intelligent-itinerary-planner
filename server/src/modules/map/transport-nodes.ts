/**
 * 交通节点数据
 * 包含中国主要城市的机场和火车站坐标信息
 */

// 机场数据
export interface Airport {
  code: string           // 机场代码
  name: string           // 机场全名
  city: string           // 所属城市
  latitude: number
  longitude: number
}

// 火车站数据
export interface TrainStation {
  name: string           // 站名
  city: string           // 所属城市
  type: 'high_speed' | 'normal' | 'both'  // 高铁站/普通站/两者都有
  latitude: number
  longitude: number
}

// 主要机场数据（按城市首字母排序）
export const AIRPORTS: Record<string, Airport> = {
  // A
  '安庆': { code: 'AQG', name: '安庆天柱山机场', city: '安庆', latitude: 30.5817, longitude: 117.0506 },
  
  // B
  '北京': { code: 'PEK', name: '北京首都国际机场', city: '北京', latitude: 40.0799, longitude: 116.6031 },
  '北京大兴': { code: 'PKX', name: '北京大兴国际机场', city: '北京', latitude: 39.5098, longitude: 116.4105 },
  '包头': { code: 'BAV', name: '包头二里半机场', city: '包头', latitude: 40.1406, longitude: 109.8003 },
  '北海': { code: 'BHY', name: '北海福成机场', city: '北海', latitude: 21.5383, longitude: 109.2953 },
  
  // C
  '长春': { code: 'CGQ', name: '长春龙嘉国际机场', city: '长春', latitude: 43.9961, longitude: 125.6850 },
  '常州': { code: 'CZX', name: '常州奔牛国际机场', city: '常州', latitude: 31.9167, longitude: 119.7833 },
  '成都': { code: 'CTU', name: '成都双流国际机场', city: '成都', latitude: 30.5785, longitude: 103.9471 },
  '成都天府': { code: 'TFU', name: '成都天府国际机场', city: '成都', latitude: 30.3194, longitude: 104.4358 },
  '重庆': { code: 'CKG', name: '重庆江北国际机场', city: '重庆', latitude: 29.7192, longitude: 106.6417 },
  
  // D
  '大连': { code: 'DLC', name: '大连周水子国际机场', city: '大连', latitude: 38.9657, longitude: 121.5386 },
  '大理': { code: 'DLU', name: '大理凤仪机场', city: '大理', latitude: 25.6472, longitude: 100.3239 },
  '东莞': { code: 'SZX', name: '深圳宝安国际机场', city: '深圳', latitude: 22.6393, longitude: 113.8107 }, // 东莞使用深圳机场
  
  // F
  '福州': { code: 'FOC', name: '福州长乐国际机场', city: '福州', latitude: 25.9351, longitude: 119.6632 },
  
  // G
  '广州': { code: 'CAN', name: '广州白云国际机场', city: '广州', latitude: 23.3924, longitude: 113.2988 },
  '桂林': { code: 'KWL', name: '桂林两江国际机场', city: '桂林', latitude: 25.2181, longitude: 110.0394 },
  '贵阳': { code: 'KWE', name: '贵阳龙洞堡国际机场', city: '贵阳', latitude: 26.3144, longitude: 106.8008 },
  
  // H
  '哈尔滨': { code: 'HRB', name: '哈尔滨太平国际机场', city: '哈尔滨', latitude: 45.6234, longitude: 126.2503 },
  '海口': { code: 'HAK', name: '海口美兰国际机场', city: '海口', latitude: 19.9349, longitude: 110.4590 },
  '杭州': { code: 'HGH', name: '杭州萧山国际机场', city: '杭州', latitude: 30.2295, longitude: 120.4344 },
  '合肥': { code: 'HFE', name: '合肥新桥国际机场', city: '合肥', latitude: 31.9805, longitude: 116.9770 },
  '呼和浩特': { code: 'HET', name: '呼和浩特白塔国际机场', city: '呼和浩特', latitude: 40.8514, longitude: 111.8240 },
  
  // J
  '济南': { code: 'TNA', name: '济南遥墙国际机场', city: '济南', latitude: 36.8572, longitude: 117.2157 },
  
  // K
  '昆明': { code: 'KMG', name: '昆明长水国际机场', city: '昆明', latitude: 25.1019, longitude: 102.9292 },
  
  // L
  '兰州': { code: 'LHW', name: '兰州中川国际机场', city: '兰州', latitude: 36.5152, longitude: 103.6205 },
  '拉萨': { code: 'LXA', name: '拉萨贡嘎机场', city: '拉萨', latitude: 29.2978, longitude: 90.9119 },
  '连云港': { code: 'LYG', name: '连云港白塔埠机场', city: '连云港', latitude: 34.5878, longitude: 119.1814 },
  '临沂': { code: 'LYI', name: '临沂沭埠岭机场', city: '临沂', latitude: 35.0475, longitude: 118.4128 },
  '柳州': { code: 'LZH', name: '柳州白莲机场', city: '柳州', latitude: 24.4978, longitude: 109.4108 },
  '洛阳': { code: 'LYA', name: '洛阳北郊机场', city: '洛阳', latitude: 34.7389, longitude: 112.3914 },
  
  // M
  '绵阳': { code: 'MIG', name: '绵阳南郊机场', city: '绵阳', latitude: 31.4289, longitude: 104.7419 },
  '牡丹江': { code: 'MDG', name: '牡丹江海浪国际机场', city: '牡丹江', latitude: 44.5339, longitude: 129.5689 },
  
  // N
  '南昌': { code: 'KHN', name: '南昌昌北国际机场', city: '南昌', latitude: 28.8650, longitude: 115.9003 },
  '南京': { code: 'NKG', name: '南京禄口国际机场', city: '南京', latitude: 31.7420, longitude: 118.8620 },
  '南宁': { code: 'NNG', name: '南宁吴圩国际机场', city: '南宁', latitude: 22.6085, longitude: 108.1723 },
  '南通': { code: 'NTG', name: '南通兴东国际机场', city: '南通', latitude: 32.0717, longitude: 120.9764 },
  '宁波': { code: 'NGB', name: '宁波栎社国际机场', city: '宁波', latitude: 29.8256, longitude: 121.4583 },
  
  // P
  '平顶山': { code: 'CGO', name: '郑州新郑国际机场', city: '郑州', latitude: 34.5197, longitude: 113.8408 }, // 使用郑州机场
  
  // Q
  '青岛': { code: 'TAO', name: '青岛胶东国际机场', city: '青岛', latitude: 36.2611, longitude: 119.8544 },
  '衢州': { code: 'JUZ', name: '衢州机场', city: '衢州', latitude: 28.9667, longitude: 118.9667 },
  '泉州': { code: 'JJN', name: '泉州晋江国际机场', city: '泉州', latitude: 24.8050, longitude: 118.5883 },
  
  // R
  '日照': { code: 'RIZ', name: '日照山字河机场', city: '日照', latitude: 35.4072, longitude: 119.3269 },
  
  // S
  '三亚': { code: 'SYX', name: '三亚凤凰国际机场', city: '三亚', latitude: 18.3029, longitude: 109.4122 },
  '上海': { code: 'SHA', name: '上海虹桥国际机场', city: '上海', latitude: 31.1979, longitude: 121.3363 },
  '上海浦东': { code: 'PVG', name: '上海浦东国际机场', city: '上海', latitude: 31.1443, longitude: 121.8083 },
  '深圳': { code: 'SZX', name: '深圳宝安国际机场', city: '深圳', latitude: 22.6393, longitude: 113.8107 },
  '沈阳': { code: 'SHE', name: '沈阳桃仙国际机场', city: '沈阳', latitude: 41.6397, longitude: 123.4833 },
  '石家庄': { code: 'SJW', name: '石家庄正定国际机场', city: '石家庄', latitude: 38.2831, longitude: 114.6994 },
  '苏州': { code: 'SZX', name: '深圳宝安国际机场', city: '深圳', latitude: 22.6393, longitude: 113.8107 }, // 苏州使用无锡/上海机场
  
  // T
  '太原': { code: 'TYN', name: '太原武宿国际机场', city: '太原', latitude: 37.7872, longitude: 112.6289 },
  '天津': { code: 'TSN', name: '天津滨海国际机场', city: '天津', latitude: 39.1244, longitude: 117.3461 },
  
  // W
  '温州': { code: 'WNZ', name: '温州龙湾国际机场', city: '温州', latitude: 27.9067, longitude: 120.8517 },
  '乌鲁木齐': { code: 'URC', name: '乌鲁木齐地窝堡国际机场', city: '乌鲁木齐', latitude: 43.9071, longitude: 87.4742 },
  '武汉': { code: 'WUH', name: '武汉天河国际机场', city: '武汉', latitude: 30.7838, longitude: 114.2081 },
  
  // X
  '厦门': { code: 'XMN', name: '厦门高崎国际机场', city: '厦门', latitude: 24.5440, longitude: 118.1277 },
  '西安': { code: 'XIY', name: '西安咸阳国际机场', city: '西安', latitude: 34.4471, longitude: 108.7519 },
  '西宁': { code: 'XNN', name: '西宁曹家堡国际机场', city: '西宁', latitude: 36.5275, longitude: 102.0433 },
  '徐州': { code: 'XUZ', name: '徐州观音国际机场', city: '徐州', latitude: 34.0581, longitude: 117.5544 },
  
  // Y
  '烟台': { code: 'YNT', name: '烟台蓬莱国际机场', city: '烟台', latitude: 37.6694, longitude: 120.9689 },
  '扬州': { code: 'YTY', name: '扬州泰州国际机场', city: '扬州', latitude: 32.5667, longitude: 119.7167 },
  '银川': { code: 'INC', name: '银川河东国际机场', city: '银川', latitude: 38.3219, longitude: 106.3927 },
  '榆林': { code: 'UYN', name: '榆林榆阳机场', city: '榆林', latitude: 38.2639, longitude: 109.7333 },
  '运城': { code: 'YCU', name: '运城张孝机场', city: '运城', latitude: 35.1161, longitude: 111.0433 },
  
  // Z
  '张家界': { code: 'DYG', name: '张家界荷花国际机场', city: '张家界', latitude: 29.1033, longitude: 110.4433 },
  '郑州': { code: 'CGO', name: '郑州新郑国际机场', city: '郑州', latitude: 34.5197, longitude: 113.8408 },
  '珠海': { code: 'ZUH', name: '珠海金湾机场', city: '珠海', latitude: 22.0086, longitude: 113.3761 },
}

// 主要高铁站数据（按城市首字母排序）
export const TRAIN_STATIONS: Record<string, TrainStation> = {
  // B
  '北京': { name: '北京南站', city: '北京', type: 'high_speed', latitude: 39.8654, longitude: 116.3789 },
  '北京西': { name: '北京西站', city: '北京', type: 'both', latitude: 39.8946, longitude: 116.3222 },
  '保定': { name: '保定东站', city: '保定', type: 'high_speed', latitude: 38.9031, longitude: 115.5022 },
  
  // C
  '常州': { name: '常州北站', city: '常州', type: 'high_speed', latitude: 31.8456, longitude: 119.9711 },
  '长春': { name: '长春站', city: '长春', type: 'both', latitude: 43.8690, longitude: 125.3289 },
  '成都': { name: '成都东站', city: '成都', type: 'high_speed', latitude: 30.6308, longitude: 104.1372 },
  '重庆': { name: '重庆北站', city: '重庆', type: 'high_speed', latitude: 29.6156, longitude: 106.5525 },
  
  // D
  '大连': { name: '大连北站', city: '大连', type: 'high_speed', latitude: 38.9756, longitude: 121.5553 },
  '德州': { name: '德州东站', city: '德州', type: 'high_speed', latitude: 37.4258, longitude: 116.3933 },
  '东莞': { name: '东莞站', city: '东莞', type: 'both', latitude: 23.0767, longitude: 113.8606 },
  
  // F
  '福州': { name: '福州南站', city: '福州', type: 'high_speed', latitude: 25.9831, longitude: 119.3831 },
  
  // G
  '广州': { name: '广州南站', city: '广州', type: 'high_speed', latitude: 22.9892, longitude: 113.2697 },
  '贵阳': { name: '贵阳北站', city: '贵阳', type: 'high_speed', latitude: 26.6542, longitude: 106.6283 },
  '桂林': { name: '桂林北站', city: '桂林', type: 'high_speed', latitude: 25.2631, longitude: 110.3194 },
  
  // H
  '哈尔滨': { name: '哈尔滨西站', city: '哈尔滨', type: 'high_speed', latitude: 45.7606, longitude: 126.5511 },
  '杭州': { name: '杭州东站', city: '杭州', type: 'high_speed', latitude: 30.2907, longitude: 120.2133 },
  '合肥': { name: '合肥南站', city: '合肥', type: 'high_speed', latitude: 31.7783, longitude: 117.3064 },
  '衡阳': { name: '衡阳东站', city: '衡阳', type: 'high_speed', latitude: 26.8756, longitude: 112.6189 },
  '湖州': { name: '湖州站', city: '湖州', type: 'high_speed', latitude: 30.8367, longitude: 120.0867 },
  '怀化': { name: '怀化南站', city: '怀化', type: 'high_speed', latitude: 27.5467, longitude: 109.9950 },
  
  // J
  '济南': { name: '济南西站', city: '济南', type: 'high_speed', latitude: 36.6511, longitude: 116.8414 },
  '金华': { name: '金华站', city: '金华', type: 'both', latitude: 29.1044, longitude: 119.6775 },
  
  // K
  '开封': { name: '开封北站', city: '开封', type: 'high_speed', latitude: 34.8144, longitude: 114.3536 },
  '昆明': { name: '昆明南站', city: '昆明', type: 'high_speed', latitude: 24.9942, longitude: 102.7981 },
  
  // L
  '兰州': { name: '兰州西站', city: '兰州', type: 'high_speed', latitude: 36.0697, longitude: 103.7289 },
  '连云港': { name: '连云港站', city: '连云港', type: 'high_speed', latitude: 34.5922, longitude: 119.1986 },
  '廊坊': { name: '廊坊站', city: '廊坊', type: 'high_speed', latitude: 39.5167, longitude: 116.6833 },
  '漯河': { name: '漯河西站', city: '漯河', type: 'high_speed', latitude: 33.5539, longitude: 114.0267 },
  
  // M
  '眉山': { name: '眉山东站', city: '眉山', type: 'high_speed', latitude: 30.0594, longitude: 103.8500 },
  '绵阳': { name: '绵阳站', city: '绵阳', type: 'high_speed', latitude: 31.4544, longitude: 104.7419 },
  
  // N
  '南昌': { name: '南昌西站', city: '南昌', type: 'high_speed', latitude: 28.6253, longitude: 115.8528 },
  '南京': { name: '南京南站', city: '南京', type: 'high_speed', latitude: 31.9722, longitude: 118.8033 },
  '南宁': { name: '南宁东站', city: '南宁', type: 'high_speed', latitude: 22.8403, longitude: 108.3717 },
  '宁波': { name: '宁波站', city: '宁波', type: 'high_speed', latitude: 29.8514, longitude: 121.5311 },
  
  // P
  '莆田': { name: '莆田站', city: '莆田', type: 'high_speed', latitude: 25.3342, longitude: 119.0156 },
  
  // Q
  '青岛': { name: '青岛北站', city: '青岛', type: 'high_speed', latitude: 36.1803, longitude: 120.3719 },
  '泉州': { name: '泉州站', city: '泉州', type: 'high_speed', latitude: 24.9008, longitude: 118.6461 },
  
  // S
  '上海': { name: '上海虹桥站', city: '上海', type: 'high_speed', latitude: 31.1949, longitude: 121.3206 },
  '深圳': { name: '深圳北站', city: '深圳', type: 'high_speed', latitude: 22.6097, longitude: 114.0297 },
  '沈阳': { name: '沈阳北站', city: '沈阳', type: 'both', latitude: 41.8289, longitude: 123.4536 },
  '石家庄': { name: '石家庄站', city: '石家庄', type: 'high_speed', latitude: 38.0253, longitude: 114.4781 },
  '苏州': { name: '苏州北站', city: '苏州', type: 'high_speed', latitude: 31.4153, longitude: 120.6319 },
  '绍兴': { name: '绍兴北站', city: '绍兴', type: 'high_speed', latitude: 30.0522, longitude: 120.6214 },
  
  // T
  '太原': { name: '太原南站', city: '太原', type: 'high_speed', latitude: 37.7994, longitude: 112.5633 },
  '天津': { name: '天津西站', city: '天津', type: 'high_speed', latitude: 39.1542, longitude: 117.0633 },
  '唐山': { name: '唐山站', city: '唐山', type: 'both', latitude: 39.6292, longitude: 118.1125 },
  
  // W
  '温州': { name: '温州南站', city: '温州', type: 'high_speed', latitude: 28.0167, longitude: 120.6817 },
  '武汉': { name: '武汉站', city: '武汉', type: 'high_speed', latitude: 30.6142, longitude: 114.4214 },
  '无锡': { name: '无锡东站', city: '无锡', type: 'high_speed', latitude: 31.6167, longitude: 120.3833 },
  '芜湖': { name: '芜湖站', city: '芜湖', type: 'both', latitude: 31.3378, longitude: 118.3808 },
  
  // X
  '厦门': { name: '厦门北站', city: '厦门', type: 'high_speed', latitude: 24.6350, longitude: 118.0967 },
  '西安': { name: '西安北站', city: '西安', type: 'high_speed', latitude: 34.3772, longitude: 108.9394 },
  '徐州': { name: '徐州东站', city: '徐州', type: 'high_speed', latitude: 34.2664, longitude: 117.3411 },
  
  // Y
  '烟台': { name: '烟台站', city: '烟台', type: 'both', latitude: 37.5333, longitude: 121.3500 },
  '盐城': { name: '盐城站', city: '盐城', type: 'high_speed', latitude: 33.3778, longitude: 120.1567 },
  '宜昌': { name: '宜昌东站', city: '宜昌', type: 'high_speed', latitude: 30.6525, longitude: 111.3578 },
  '义乌': { name: '义乌站', city: '义乌', type: 'both', latitude: 29.3544, longitude: 120.0481 },
  '永州': { name: '永州站', city: '永州', type: 'both', latitude: 26.4333, longitude: 111.6000 },
  
  // Z
  '漳州': { name: '漳州站', city: '漳州', type: 'high_speed', latitude: 24.4928, longitude: 117.6433 },
  '郑州': { name: '郑州东站', city: '郑州', type: 'high_speed', latitude: 34.7544, longitude: 113.7764 },
  '株洲': { name: '株洲西站', city: '株洲', type: 'high_speed', latitude: 27.8272, longitude: 113.1011 },
  '珠海': { name: '珠海站', city: '珠海', type: 'high_speed', latitude: 22.2269, longitude: 113.5372 },
  '驻马店': { name: '驻马店西站', city: '驻马店', type: 'high_speed', latitude: 33.0044, longitude: 114.0167 },
}

/**
 * 从城市名查找机场
 */
export function findAirportByCity(cityName: string): Airport | null {
  // 清理城市名
  const city = cityName.replace(/[市站场机场]/g, '').trim()
  
  // 直接匹配
  if (AIRPORTS[city]) {
    return AIRPORTS[city]
  }
  
  // 模糊匹配（查找包含关键词的）
  for (const [key, airport] of Object.entries(AIRPORTS)) {
    if (key.includes(city) || city.includes(key)) {
      return airport
    }
  }
  
  return null
}

/**
 * 从城市名查找火车站
 */
export function findStationByCity(cityName: string): TrainStation | null {
  // 清理城市名
  const city = cityName.replace(/[市站]/g, '').trim()
  
  // 直接匹配
  if (TRAIN_STATIONS[city]) {
    return TRAIN_STATIONS[city]
  }
  
  // 模糊匹配
  for (const [key, station] of Object.entries(TRAIN_STATIONS)) {
    if (key.includes(city) || city.includes(key)) {
      return station
    }
  }
  
  return null
}

/**
 * 检查地点名是否是机场
 */
export function isAirport(locationName: string): boolean {
  const name = locationName.toLowerCase()
  return name.includes('机场') || name.includes('国际机场') || name.includes('航空港')
}

/**
 * 检查地点名是否是火车站
 */
export function isTrainStation(locationName: string): boolean {
  const name = locationName.toLowerCase()
  return name.includes('站') && !name.includes('地铁站') && !name.includes('汽车站')
}

/**
 * 交通方式合理性行政规则
 */
export const TRANSPORT_RULES = {
  taxi: {
    maxDistance: 50000,      // 50km 以内打车合理
    warningDistance: 30000,  // 30km 以上提示
    message: '打车适合市内短途出行，跨城建议选择高铁或飞机'
  },
  train: {
    minDistance: 30000,      // 30km 以上适合高铁
    maxDistance: 2000000,    // 2000km 以内
    mustBeStation: true,     // 起终点必须是火车站
    message: '高铁起终点应该是火车站'
  },
  flight: {
    minDistance: 300000,     // 300km 以上适合飞机
    mustBeAirport: true,     // 起终点必须是机场
    message: '飞机起终点应该是机场'
  }
}
