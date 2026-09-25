// Tauri type declarations
// This file extends the Window interface for Tauri-specific properties
// The actual types come from @tauri-apps/api

declare global {
  interface Window {
    __TAURI__?: {
      convertFileSrc: (src: string, protocol: string) => string;
    };
    __TAURI_METADATA__?: {
      __currentWindow__: {
        label: string;
      };
      __windows__: Array<{
        label: string;
      }>;
    };
  }
}

export {};
