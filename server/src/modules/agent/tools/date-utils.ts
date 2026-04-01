/**
 * 日期范围查询工具
 * 
 * 统一处理日期查询，避免时区问题
 * 数据库存储使用 +08:00 时区，查询时自动转换
 */

/**
 * 获取某天的日期范围（00:00 - 23:59:59）
 * @param date 日期字符串，格式 YYYY-MM-DD
 * @param timezone 时区，默认东八区
 */
export function getDayRange(date: string, timezone: string = '+08:00'): { start: string; end: string } {
  return {
    start: `${date}T00:00:00${timezone}`,
    end: `${date}T23:59:59${timezone}`,
  }
}

/**
 * 获取日期范围的查询条件
 * @param startDate 开始日期 YYYY-MM-DD
 * @param endDate 结束日期 YYYY-MM-DD
 * @param timezone 时区，默认东八区
 */
export function getDateRangeQuery(
  startDate: string,
  endDate: string,
  timezone: string = '+08:00'
): { start: string; end: string } {
  return {
    start: `${startDate}T00:00:00${timezone}`,
    end: `${endDate}T23:59:59${timezone}`,
  }
}

/**
 * 统一处理 date 参数，支持字符串或数组
 * - 字符串 "2025-01-15" → 单日查询
 * - 数组 ["2025-01-15", "2025-01-16"] → 范围查询
 * @param date 日期参数（字符串或数组）
 * @returns 日期范围 { start, end }
 */
export function parseDateParam(
  date: string | string[]
): { start: string; end: string } {
  if (Array.isArray(date)) {
    // 数组 → 范围查询
    const [start, end] = date
    return getDateRangeQuery(start, end)
  } else {
    // 字符串 → 单日查询
    return getDayRange(date)
  }
}

/**
 * 构建日期范围查询的 Supabase 查询
 * @param query Supabase 查询对象
 * @param date 单个日期 YYYY-MM-DD
 * @param field 字段名，默认 scheduled_time
 */
export function applyDateFilter<T>(
  query: any,
  date: string,
  field: string = 'scheduled_time'
): any {
  const { start, end } = getDayRange(date)
  return query.gte(field, start).lte(field, end)
}

/**
 * 构建日期范围查询的 Supabase 查询
 * @param query Supabase 查询对象
 * @param startDate 开始日期 YYYY-MM-DD
 * @param endDate 结束日期 YYYY-MM-DD
 * @param field 字段名，默认 scheduled_time
 */
export function applyDateRangeFilter<T>(
  query: any,
  startDate: string,
  endDate: string,
  field: string = 'scheduled_time'
): any {
  const { start, end } = getDateRangeQuery(startDate, endDate)
  return query.gte(field, start).lte(field, end)
}
