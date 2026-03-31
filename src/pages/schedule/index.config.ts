export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '日程管理',
      enablePullDownRefresh: true,
    })
  : {
      navigationBarTitleText: '日程管理',
      enablePullDownRefresh: true,
    }
