import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.inftelekarbala.app',
    appName: 'InfTeleKarbala',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    }
};

export default config;
