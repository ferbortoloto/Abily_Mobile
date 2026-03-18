import { DeviceEventEmitter } from 'react-native';

const TOAST_EVENT = 'ABILY_TOAST';

export const toast = {
  success: (message) => DeviceEventEmitter.emit(TOAST_EVENT, { message, type: 'success' }),
  error:   (message) => DeviceEventEmitter.emit(TOAST_EVENT, { message, type: 'error' }),
  info:    (message) => DeviceEventEmitter.emit(TOAST_EVENT, { message, type: 'info' }),
  _event: TOAST_EVENT,
};
