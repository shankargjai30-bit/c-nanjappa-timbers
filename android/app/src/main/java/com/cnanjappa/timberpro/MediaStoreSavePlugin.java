package com.cnanjappa.timberpro;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "MediaStoreSavePlugin")
public class MediaStoreSavePlugin extends Plugin {
    private static final String TAG = "MediaStoreSavePlugin";

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        Log.d(TAG, "filename: " + fileName);
        Log.d(TAG, "MIME type: " + mimeType);

        if (fileName == null || fileName.trim().isEmpty()) {
            Log.e(TAG, "MediaStoreSavePlugin ERROR: fileName is required");
            call.reject("fileName is required");
            return;
        }

        if (base64Data == null || base64Data.trim().isEmpty()) {
            Log.e(TAG, "MediaStoreSavePlugin ERROR: base64Data is required");
            call.reject("base64Data is required");
            return;
        }

        Log.d(TAG, "incoming base64 length: " + base64Data.length());

        byte[] decodedBytes;
        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "MediaStoreSavePlugin ERROR: Invalid base64 data: " + e.getMessage(), e);
            call.reject("Invalid base64 data: " + e.getMessage(), e);
            return;
        }

        if (decodedBytes == null || decodedBytes.length == 0) {
            Log.e(TAG, "MediaStoreSavePlugin ERROR: Decoded file byte length is 0");
            call.reject("Decoded file byte length is 0");
            return;
        }

        Log.d(TAG, "decoded byte length: " + decodedBytes.length);

        Context context = getContext();
        Uri savedUri = null;
        String verifiedDisplayName = fileName;
        String displayPath = Environment.DIRECTORY_DOWNLOADS + "/" + fileName;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = context.getContentResolver();
                Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;

                // Remove existing file with the same name if previously created in app scope
                try {
                    String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=?";
                    String[] selectionArgs = new String[]{fileName};
                    resolver.delete(collection, selection, selectionArgs);
                } catch (Exception e) {
                    Log.w(TAG, "Previous record deletion ignored: " + e.getMessage());
                }

                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                savedUri = resolver.insert(collection, values);
                if (savedUri == null) {
                    throw new IOException("ContentResolver.insert() returned null for: " + fileName);
                }

                Log.d(TAG, "MediaStore URI: " + savedUri);

                try (OutputStream out = resolver.openOutputStream(savedUri, "w")) {
                    if (out == null) {
                        throw new IOException("openOutputStream returned null for URI: " + savedUri);
                    }
                    out.write(decodedBytes);
                    out.flush();
                }

                Log.d(TAG, "bytes actually written: " + decodedBytes.length);

                // Update IS_PENDING = 0 to finalize file in public Downloads
                ContentValues completed = new ContentValues();
                completed.put(MediaStore.Downloads.IS_PENDING, 0);
                int updatedRows = resolver.update(savedUri, completed, null, null);
                Log.d(TAG, "finalize result: updatedRows = " + updatedRows);

                if (updatedRows == 0) {
                    throw new IOException("Failed to finalize MediaStore record (IS_PENDING=0 update affected 0 rows)");
                }

                // Query and verify metadata
                long verifiedMetaSize = -1;
                String verifiedRelativePath = "";
                try (Cursor cursor = resolver.query(savedUri, null, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (nameIdx != -1) {
                            verifiedDisplayName = cursor.getString(nameIdx);
                        }
                        int sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE);
                        if (sizeIdx != -1) {
                            verifiedMetaSize = cursor.getLong(sizeIdx);
                        }
                        int pathIdx = cursor.getColumnIndex(MediaStore.Downloads.RELATIVE_PATH);
                        if (pathIdx != -1) {
                            verifiedRelativePath = cursor.getString(pathIdx);
                        }
                    }
                }

                Log.d(TAG, "Metadata verification: name=" + verifiedDisplayName + ", metaSize=" + verifiedMetaSize + ", path=" + verifiedRelativePath);

                // Physical byte read-back verification
                long bytesReadBack = 0;
                try (InputStream in = resolver.openInputStream(savedUri)) {
                    if (in == null) {
                        throw new IOException("Cannot open input stream to verify saved file: " + savedUri);
                    }
                    byte[] buffer = new byte[8192];
                    int r;
                    while ((r = in.read(buffer)) != -1) {
                        bytesReadBack += r;
                    }
                }

                Log.d(TAG, "Physical byte verification: readBack=" + bytesReadBack + " (expected=" + decodedBytes.length + ")");

                if (bytesReadBack != decodedBytes.length || bytesReadBack == 0) {
                    // Clean up bad file on failure
                    try {
                        resolver.delete(savedUri, null, null);
                    } catch (Exception ignored) {}
                    throw new IOException("Verification failed: written byte count (" + bytesReadBack + ") does not match original bytes (" + decodedBytes.length + ")");
                }

                displayPath = (verifiedRelativePath != null && !verifiedRelativePath.isEmpty())
                    ? verifiedRelativePath + verifiedDisplayName
                    : Environment.DIRECTORY_DOWNLOADS + "/" + verifiedDisplayName;

            } else {
                // Legacy Android (API < 29)
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
                    throw new IOException("Failed to create public Downloads directory: " + downloadsDir.getAbsolutePath());
                }
                File targetFile = new File(downloadsDir, fileName);

                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(decodedBytes);
                    fos.flush();
                }

                Log.d(TAG, "bytes actually written: " + decodedBytes.length);

                if (!targetFile.exists() || targetFile.length() != decodedBytes.length) {
                    throw new IOException("Verification failed: target file length (" + targetFile.length() + ") != expected (" + decodedBytes.length + ")");
                }

                savedUri = Uri.fromFile(targetFile);
                displayPath = targetFile.getAbsolutePath();
                verifiedDisplayName = targetFile.getName();

                android.media.MediaScannerConnection.scanFile(
                    context,
                    new String[]{targetFile.getAbsolutePath()},
                    new String[]{mimeType},
                    null
                );

                Log.d(TAG, "finalize result: legacy file scanned at " + displayPath);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("verified", true);
            ret.put("uri", savedUri.toString());
            ret.put("path", displayPath);
            ret.put("filename", verifiedDisplayName);
            ret.put("name", verifiedDisplayName);
            ret.put("bytesWritten", decodedBytes.length);
            ret.put("size", decodedBytes.length);
            ret.put("mimeType", mimeType);
            ret.put("location", "Downloads");
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "MediaStoreSavePlugin ERROR: " + e.getMessage(), e);
            if (savedUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    context.getContentResolver().delete(savedUri, null, null);
                } catch (Exception ignored) {}
            }
            call.reject("Failed to save file to Downloads: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String uriString = call.getString("uri");
        String mimeType = call.getString("mimeType", "*/*");
        String title = call.getString("title", "Share File");
        String dialogTitle = call.getString("dialogTitle", "Open or Share File");

        Log.d(TAG, "shareFile: uri=" + uriString + ", mimeType=" + mimeType);

        if (uriString == null || uriString.trim().isEmpty()) {
            Log.e(TAG, "MediaStoreSavePlugin ERROR: uri is required for shareFile");
            call.reject("uri is required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            if (title != null && !title.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            }
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, dialogTitle);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "MediaStoreSavePlugin ERROR (shareFile): " + e.getMessage(), e);
            call.reject("Failed to share file: " + e.getMessage(), e);
        }
    }
}
