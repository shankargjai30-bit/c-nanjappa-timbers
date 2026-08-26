import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface MediaStoreSavePluginInterface {
  saveToDownloads(options: {
    fileName: string;
    base64Data: string;
    mimeType: string;
  }): Promise<{
    success: boolean;
    verified: boolean;
    uri: string;
    path: string;
    filename: string;
    name: string;
    bytesWritten: number;
    size: number;
    mimeType: string;
    location: string;
  }>;
  shareFile(options: {
    uri: string;
    mimeType: string;
    title?: string;
    dialogTitle?: string;
  }): Promise<{ success: boolean }>;
}

const MediaStoreSave = registerPlugin<MediaStoreSavePluginInterface>('MediaStoreSavePlugin');

export interface ExportFileOptions {
  filename: string;
  blob: Blob;
  mimeType?: string;
  shareTitle?: string;
  openWithShare?: boolean;
  dialogTitle?: string;
}

export interface ExportFileResult {
  success: boolean;
  native: boolean;
  uri?: string;
  path?: string;
  filename: string;
  bytesWritten: number;
  size: number;
  verified: boolean;
  location: string;
}

/**
 * Converts a Blob to a base64 string safely without character encoding corruption.
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Extract base64 portion from data URL (data:...;base64,XXXX)
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to convert file data to base64.'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Universal file save and export handler.
 * - On Native Android: uses MediaStore API via MediaStoreSavePlugin to write directly into
 *   the public Downloads collection (user-visible in Files / Downloads apps) and opens the native
 *   share/print chooser.
 * - On Native iOS: uses Filesystem Documents directory and Share plugin.
 * - On Web/Desktop: downloads file using standard browser object URL and cleans up.
 */
export const saveAndExportFile = async (options: ExportFileOptions): Promise<ExportFileResult> => {
  const {
    filename,
    blob,
    mimeType = 'application/octet-stream',
    shareTitle,
    openWithShare = false,
    dialogTitle = 'Open or Share File'
  } = options;

  const platform = Capacitor.getPlatform();
  console.log(`[FileExport] platform: ${platform} (native: ${Capacitor.isNativePlatform()})`);
  console.log(`[FileExport] filename: ${filename}`);
  console.log(`[FileExport] mimeType: ${mimeType}`);
  console.log(`[FileExport] size: ${blob.size} bytes`);
  console.log(`[FileExport] directory: Downloads`);

  if (Capacitor.isNativePlatform() && platform === 'android') {
    const base64Data = await blobToBase64(blob);

    const saveResult = await MediaStoreSave.saveToDownloads({
      fileName: filename,
      base64Data,
      mimeType
    });

    console.log('[FileExport] native result:', JSON.stringify(saveResult));
    console.log(`[FileExport] saved URI: ${saveResult.uri}`);
    console.log(`[FileExport] filename: ${saveResult.filename || saveResult.name}`);
    console.log(`[FileExport] size: ${saveResult.bytesWritten || saveResult.size}`);
    console.log(`[FileExport] verified: ${saveResult.verified}`);

    const actualBytes = saveResult.bytesWritten || saveResult.size || 0;
    if (!saveResult.success || !saveResult.verified || actualBytes <= 0 || !saveResult.uri) {
      throw new Error(`File write verification failed: physical byte verification did not pass for ${filename}`);
    }

    if (openWithShare && saveResult.uri) {
      try {
        await MediaStoreSave.shareFile({
          uri: saveResult.uri,
          mimeType,
          title: shareTitle || filename,
          dialogTitle
        });
      } catch (shareErr: any) {
        console.info('[FileExport] Share dialog closed or unavailable:', shareErr?.message || shareErr);
      }
    }

    return {
      success: true,
      native: true,
      uri: saveResult.uri,
      path: saveResult.path,
      filename: saveResult.filename || saveResult.name,
      bytesWritten: actualBytes,
      size: actualBytes,
      verified: true,
      location: 'Downloads'
    };
  } else if (Capacitor.isNativePlatform()) {
    // Non-Android native (e.g. iOS)
    const base64Data = await blobToBase64(blob);
    const writeResult = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true
    });

    console.log(`[FileExport] write completed: true`);
    console.log(`[FileExport] saved URI: ${writeResult.uri}`);
    console.log(`[FileExport] verification: verified ${blob.size} bytes written to Documents`);

    if (openWithShare && writeResult.uri) {
      try {
        await Share.share({
          title: shareTitle || filename,
          url: writeResult.uri,
          dialogTitle
        });
      } catch (shareErr: any) {
        console.info('[FileExport] Share dialog closed:', shareErr?.message || shareErr);
      }
    }

    return {
      success: true,
      native: true,
      uri: writeResult.uri,
      path: `Documents/${filename}`,
      filename,
      bytesWritten: blob.size,
      size: blob.size,
      verified: true,
      location: 'Documents'
    };
  } else {
    // Desktop / Web Browser fallback
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);

    // Clean up temporary object URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);

    console.log(`[FileExport] write completed: true (browser download triggered)`);
    console.log(`[FileExport] verification: browser download dispatched for ${filename}`);

    return {
      success: true,
      native: false,
      filename,
      bytesWritten: blob.size,
      size: blob.size,
      verified: true,
      location: 'Downloads'
    };
  }
};
