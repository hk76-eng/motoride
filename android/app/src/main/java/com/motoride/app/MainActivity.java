package com.motoride.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Main Activity for MotoRide.
 * Manages native lifecycle callbacks to automatically toggle the system-wide
 * floating overlay visibility when MotoRide moves between foreground and background.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the Native Floating Overlay Plugin with Capacitor
        registerPlugin(FloatingOverlayPlugin.class);
        super.onCreate(savedInstanceState);

        // Also inject a direct JavascriptInterface for high compatibility
        setupDirectWebBridge();
    }

    private void setupDirectWebBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public boolean checkPermission() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            return Settings.canDrawOverlays(MainActivity.this);
                        }
                        return true;
                    }

                    @JavascriptInterface
                    public boolean requestPermission() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            if (!Settings.canDrawOverlays(MainActivity.this)) {
                                try {
                                    Intent intent = new Intent(
                                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                            Uri.parse("package:" + getPackageName())
                                    );
                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(intent);
                                    return true;
                                } catch (Exception e) {
                                    return false;
                                }
                            }
                        }
                        return true;
                    }

                    @JavascriptInterface
                    public void startOverlay() {
                        FloatingOverlayService.startService(MainActivity.this);
                    }

                    @JavascriptInterface
                    public void stopOverlay() {
                        FloatingOverlayService.stopService(MainActivity.this);
                    }

                    @JavascriptInterface
                    public boolean isEnabled() {
                        return FloatingOverlayService.isOverlayFeatureEnabled(MainActivity.this);
                    }

                    @JavascriptInterface
                    public void setAppInForeground(boolean isForeground) {
                        FloatingOverlayService.setAppInForegroundState(MainActivity.this, isForeground);
                    }
                }, "AndroidOverlay");
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Requirement 9, 21: When MotoRide enters foreground, floating icon is hidden
        FloatingOverlayService.setAppInForegroundState(this, true);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Requirement 10, 21: When MotoRide goes to background, floating icon becomes visible
        FloatingOverlayService.setAppInForegroundState(this, false);
    }

    @Override
    protected void onStop() {
        super.onStop();
        FloatingOverlayService.setAppInForegroundState(this, false);
    }
}
