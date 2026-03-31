/**
 * Taro 真机防溢出工具函数
 * 解决小程序真机右侧内容溢出和底部留白问题
 */

import Taro from '@tarojs/taro'

/**
 * 获取 ScrollView 安全高度
 * @param headerHeight 头部区域高度（px）
 * @param bottomOffset 底部偏移（TabBar 高度等，默认 50px）
 * @returns ScrollView 高度（px）
 */
export function getScrollViewHeight(
  headerHeight: number = 0, 
  bottomOffset: number = 50
): number {
  const systemInfo = Taro.getSystemInfoSync()
  return systemInfo.windowHeight - headerHeight - bottomOffset
}

/**
 * 获取底部安全区域高度（TabBar + 安全区域）
 * @returns 底部安全高度（px）
 */
export function getBottomSafeHeight(): number {
  const systemInfo = Taro.getSystemInfoSync()
  // TabBar 高度约 50px，加上安全区域
  const tabBarHeight = 50
  const safeAreaBottom = systemInfo.safeArea?.bottom || systemInfo.windowHeight
  const screenHeight = systemInfo.screenHeight
  const safeBottom = screenHeight - safeAreaBottom
  return tabBarHeight + safeBottom
}

/**
 * 生成防溢出样式对象
 * @returns 防溢出样式对象
 */
export function getSafeAreaStyle(): Record<string, string | number> {
  return {
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'hidden',
    boxSizing: 'border-box'
  }
}

/**
 * 生成根容器样式
 * @param bgColor 背景颜色
 * @returns 根容器样式对象
 */
export function getRootContainerStyle(bgColor: string = '#f5f5f5'): Record<string, string | number> {
  return {
    width: '100%',
    maxWidth: '100vw',
    height: '100%',
    backgroundColor: bgColor,
    boxSizing: 'border-box',
    overflow: 'hidden',
    overflowX: 'hidden'
  }
}

/**
 * 生成 ScrollView 样式
 * @param height ScrollView 高度（px）
 * @param paddingBottom 底部内边距（px）
 * @returns ScrollView 样式对象
 */
export function getScrollViewStyle(
  height: number, 
  paddingBottom: number = 0
): Record<string, string | number> {
  return {
    height: `${height}px`,
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'hidden',
    paddingBottom: `${paddingBottom}px`
  }
}

/**
 * 生成底部固定元素样式（预留 TabBar 高度）
 * @param bgColor 背景颜色
 * @returns 底部固定元素样式对象
 */
export function getBottomFixedStyle(bgColor: string = '#fff'): Record<string, string | number> {
  const bottomSafeHeight = getBottomSafeHeight()
  return {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    maxWidth: '100vw',
    backgroundColor: bgColor,
    paddingBottom: `${bottomSafeHeight}px`,
    zIndex: 100
  }
}
