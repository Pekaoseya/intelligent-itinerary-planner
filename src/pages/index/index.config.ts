export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '智能助手',
    })
  : {
      navigationBarTitleText: '智能助手',
    }
