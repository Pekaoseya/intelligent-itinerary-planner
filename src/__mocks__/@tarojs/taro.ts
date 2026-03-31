/**
 * Taro API Mock
 */

export const Taro = {
  getEnv: () => 'WEAPP',
  ENV_TYPE: {
    WEAPP: 'WEAPP',
    H5: 'H5',
    APP: 'APP',
  },
  showToast: jest.fn(),
  showModal: jest.fn(),
  getLocation: jest.fn().mockResolvedValue({
    latitude: 30.242489,
    longitude: 120.148532,
  }),
  getSystemInfoSync: jest.fn().mockReturnValue({
    windowHeight: 800,
    windowWidth: 375,
  }),
  switchTab: jest.fn(),
  navigateTo: jest.fn(),
  makePhoneCall: jest.fn(),
}

export default Taro
