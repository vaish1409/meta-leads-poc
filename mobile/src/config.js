import { Platform } from 'react-native';
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
export const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || fallback;
export const CLIENT_TOKEN = process.env.EXPO_PUBLIC_CLIENT_TOKEN || '';
