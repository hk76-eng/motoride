package com.motoride.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor Bridge Plugin for MotoRide Native Floating Overlay.
 * Allows JavaScript / React components to check permissions, launch settings,
 * and start/stop the system-level floating chat-head overlay.
 */
@CapacitorPlugin(name = "FloatingOverlay")
public class FloatingOverlayPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        Context context = getContext();
        boolean hasPermission = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            hasPermission = Settings.canDrawOverlays(context);
        } else {
            hasPermission = true;
        }

        JSObject ret = new JSObject();
        ret.put("granted", hasPermission);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Context context = getContext();
        boolean hasPermission = false;
        boolean openedSettings = false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            hasPermission = Settings.canDrawOverlays(context);
            if (!hasPermission) {
                try {
                    Intent intent = new Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + context.getPackageName())
                    );
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    openedSettings = true;
                } catch (Exception e) {
                    // Fallback to general overlay settings screen if package-specific fails
                    try {
                        Intent fallbackIntent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                        fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(fallbackIntent);
                        openedSettings = true;
                    } catch (Exception ex) {
                        openedSettings = false;
                    }
                }
            }
        } else {
            hasPermission = true;
        }

        JSObject ret = new JSObject();
        ret.put("granted", hasPermission);
        ret.put("openedSettings", openedSettings);
        call.resolve(ret);
    }

    @PluginMethod
    public void startOverlay(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "PERMISSION_DENIED");
            call.resolve(ret);
            return;
        }

        FloatingOverlayService.startService(context);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopOverlay(PluginCall call) {
        Context context = getContext();
        FloatingOverlayService.stopService(context);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        Context context = getContext();
        boolean enabled = FloatingOverlayService.isOverlayFeatureEnabled(context);
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void setAppInForeground(PluginCall call) {
        Context context = getContext();
        boolean isForeground = call.getBoolean("isForeground", true);
        FloatingOverlayService.setAppInForegroundState(context, isForeground);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
