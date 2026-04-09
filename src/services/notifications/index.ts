/**
 * index.ts
 * 
 * Barrel file for the notifications service.
 * This defines the public API of our isolated notification module.
 */

export { sendPushNotification } from './PushService';
export type { PushNotificationOptions } from './PushService';

export { initOneSignal, logoutOneSignal, requestNotificationPermission } from './OneSignalService';
