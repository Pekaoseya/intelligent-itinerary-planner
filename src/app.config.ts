export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/schedule/index',
    'pages/profile/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '智能助手',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#1890ff',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '助手',
        iconPath: './assets/tabbar/message-square.png',
        selectedIconPath: './assets/tabbar/message-square-active.png',
      },
      {
        pagePath: 'pages/schedule/index',
        text: '日程',
        iconPath: './assets/tabbar/calendar.png',
        selectedIconPath: './assets/tabbar/calendar-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png',
      },
    ],
  },
  // 地图权限配置
  permission: {
    'scope.userLocation': {
      desc: '您的位置信息将用于展示出行路线',
    },
  },
  requiredPrivateInfos: ['getLocation'],
})
