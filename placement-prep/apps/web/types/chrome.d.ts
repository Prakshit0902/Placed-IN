/**
 * Chrome Extension API type declarations.
 * Allows TypeScript to recognise `window.chrome.runtime.*` usage
 * without requiring @types/chrome as a full dependency.
 */
interface Window {
  chrome?: {
    runtime?: {
      connect(
        extensionId: string,
        connectInfo?: { name?: string },
      ): {
        onMessage: {
          addListener(callback: (msg: any) => void): void;
        };
        postMessage(msg: any): void;
        disconnect(): void;
      };
      sendMessage(
        extensionId: string,
        message: any,
        callback?: (response: any) => void,
      ): void;
    };
  };
}
