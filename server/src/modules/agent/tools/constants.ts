/**
 * 工具模块常量定义
 */

// 默认坐标（杭州西湖）- 用于测试和极端情况
export const DEFAULT_LOCATION = {
  latitude: 30.242489,
  longitude: 120.148532,
  name: '杭州西湖',
}

// 地图 API 基础 URL
export const TENCENT_MAP_BASE_URL = 'https://apis.map.qq.com/ws'
export const AMAP_BASE_URL = 'https://restapi.amap.com'

// 常见城市名列表
export const COMMON_CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都',
  '武汉', '西安', '重庆', '天津', '长沙', '郑州', '青岛', '厦门',
  '福州', '济南', '合肥', '南昌', '昆明', '贵阳', '南宁', '海口',
  '三亚', '大连', '沈阳', '哈尔滨', '长春', '石家庄', '太原', '呼和浩特',
  '兰州', '银川', '西宁', '乌鲁木齐', '拉萨', '宁波', '温州', '无锡',
]
