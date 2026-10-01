package com.motoride.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Native Android Floating Overlay Service for MotoRide.
 * Provides a system-wide, draggable chat-head overlay visible over all external apps
 * (Uber, inDrive, WhatsApp, Chrome, Maps, etc.) using SYSTEM_ALERT_WINDOW.
 */
public class FloatingOverlayService extends Service {

    private static final String TAG = "FloatingOverlayService";
    private static final int NOTIFICATION_ID = 90210;
    private static final String CHANNEL_ID = "motoride_overlay_channel";
    private static final String PREFS_NAME = "motoride_overlay_prefs";
    private static final String PREF_KEY_ENABLED = "overlay_enabled";

    public static final String ACTION_START = "com.motoride.app.ACTION_START_OVERLAY";
    public static final String ACTION_STOP = "com.motoride.app.ACTION_STOP_OVERLAY";
    public static final String ACTION_SET_FOREGROUND_STATE = "com.motoride.app.ACTION_SET_FOREGROUND_STATE";
    public static final String EXTRA_IS_FOREGROUND = "extra_is_foreground";

    private static FloatingOverlayService sInstance = null;
    private static boolean sIsAppInForeground = true;

    private WindowManager mWindowManager;
    private View mOverlayView;
    private WindowManager.LayoutParams mLayoutParams;
    private boolean mIsViewAttached = false;

    // Drag and Touch tracking
    private int mInitialX;
    private int mInitialY;
    private float mInitialTouchX;
    private float mInitialTouchY;
    private long mTouchStartTime;

    public static boolean isServiceRunning() {
        return sInstance != null;
    }

    public static boolean isOverlayFeatureEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(PREF_KEY_ENABLED, false);
    }

    public static void setOverlayFeatureEnabled(Context context, boolean enabled) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(PREF_KEY_ENABLED, enabled).apply();
    }

    /**
     * Notify the service of MotoRide's foreground/background lifecycle state.
     */
    public static void setAppInForegroundState(Context context, boolean isForeground) {
        sIsAppInForeground = isForeground;
        if (sInstance != null) {
            sInstance.updateOverlayVisibility();
        } else if (!isForeground && isOverlayFeatureEnabled(context)) {
            // If app goes to background and service is enabled but not running, start it
            startService(context);
        }
    }

    public static void startService(Context context) {
        if (!Settings.canDrawOverlays(context)) {
            Log.w(TAG, "Cannot start overlay service: SYSTEM_ALERT_WINDOW permission missing");
            return;
        }

        setOverlayFeatureEnabled(context, true);
        Intent intent = new Intent(context, FloatingOverlayService.class);
        intent.setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stopService(Context context) {
        setOverlayFeatureEnabled(context, false);
        Intent intent = new Intent(context, FloatingOverlayService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        mWindowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        createNotificationChannel();
        startInForeground();
        setupFloatingView();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopSelf();
                return START_NOT_STICKY;
            } else if (ACTION_SET_FOREGROUND_STATE.equals(action)) {
                sIsAppInForeground = intent.getBooleanExtra(EXTRA_IS_FOREGROUND, false);
                updateOverlayVisibility();
            } else if (ACTION_START.equals(action)) {
                updateOverlayVisibility();
            }
        }
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.overlay_service_channel_name),
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription(getString(R.string.overlay_service_channel_desc));
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startInForeground() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.overlay_notification_title))
                .setContentText(getString(R.string.overlay_notification_text))
                .setSmallIcon(R.drawable.ic_motoride_floating)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 14+ / 10+ foreground service declaration
            try {
                if (Build.VERSION.SDK_INT >= 34) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
            } catch (Exception e) {
                Log.w(TAG, "startForeground with type failed, falling back", e);
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void setupFloatingView() {
        if (mOverlayView != null || !Settings.canDrawOverlays(this)) {
            return;
        }

        try {
            LayoutInflater inflater = LayoutInflater.from(this);
            mOverlayView = inflater.inflate(R.layout.floating_overlay_layout, null);

            int layoutType;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                layoutType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            } else {
                layoutType = WindowManager.LayoutParams.TYPE_PHONE;
            }

            mLayoutParams = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT
            );

            mLayoutParams.gravity = Gravity.TOP | Gravity.START;

            // Default position on right-middle of screen
            DisplayMetrics metrics = getResources().getDisplayMetrics();
            mLayoutParams.x = metrics.widthPixels - dpToPx(72);
            mLayoutParams.y = (int) (metrics.heightPixels * 0.45f);

            View iconContainer = mOverlayView.findViewById(R.id.floating_icon_container);
            iconContainer.setOnTouchListener(new View.OnTouchListener() {
                private int clickThreshold = dpToPx(12);

                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            mInitialX = mLayoutParams.x;
                            mInitialY = mLayoutParams.y;
                            mInitialTouchX = event.getRawX();
                            mInitialTouchY = event.getRawY();
                            mTouchStartTime = System.currentTimeMillis();
                            return true;

                        case MotionEvent.ACTION_MOVE:
                            int deltaX = (int) (event.getRawX() - mInitialTouchX);
                            int deltaY = (int) (event.getRawY() - mInitialTouchY);
                            mLayoutParams.x = mInitialX + deltaX;
                            mLayoutParams.y = mInitialY + deltaY;

                            if (mIsViewAttached && mWindowManager != null) {
                                mWindowManager.updateViewLayout(mOverlayView, mLayoutParams);
                            }
                            return true;

                        case MotionEvent.ACTION_UP:
                            float totalDistance = (float) Math.hypot(
                                    event.getRawX() - mInitialTouchX,
                                    event.getRawY() - mInitialTouchY
                            );
                            long duration = System.currentTimeMillis() - mTouchStartTime;

                            // Check if action was a click/tap
                            if (totalDistance < clickThreshold && duration < 350) {
                                onFloatingIconClicked();
                            } else {
                                snapToNearestEdge();
                            }
                            return true;
                    }
                    return false;
                }
            });

            mWindowManager.addView(mOverlayView, mLayoutParams);
            mIsViewAttached = true;
            updateOverlayVisibility();

        } catch (Exception e) {
            Log.e(TAG, "Error initializing floating overlay view", e);
        }
    }

    /**
     * User tapped the floating MotoRide icon:
     * Immediately brings MotoRide app to the foreground and hides overlay!
     */
    private void onFloatingIconClicked() {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_SINGLE_TOP |
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(intent);

            // Hide overlay immediately as MotoRide comes to foreground
            sIsAppInForeground = true;
            updateOverlayVisibility();
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch MainActivity on overlay click", e);
        }
    }

    /**
     * Snaps the floating chat-head icon to the nearest edge (left or right)
     * of the device display smoothly.
     */
    private void snapToNearestEdge() {
        if (!mIsViewAttached || mWindowManager == null) return;

        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int screenWidth = metrics.widthPixels;
        int middleX = screenWidth / 2;

        if (mLayoutParams.x + dpToPx(30) < middleX) {
            mLayoutParams.x = dpToPx(4); // Snap to left edge
        } else {
            mLayoutParams.x = screenWidth - dpToPx(64); // Snap to right edge
        }

        // Clamp Y to stay within visible screen bounds
        int minY = dpToPx(60);
        int maxY = metrics.heightPixels - dpToPx(120);
        if (mLayoutParams.y < minY) mLayoutParams.y = minY;
        if (mLayoutParams.y > maxY) mLayoutParams.y = maxY;

        try {
            mWindowManager.updateViewLayout(mOverlayView, mLayoutParams);
        } catch (Exception ignored) {}
    }

    /**
     * Requirement 9, 10, 21:
     * - MotoRide in foreground -> floating icon GONE / hidden
     * - MotoRide in background -> floating icon VISIBLE above other apps
     */
    public void updateOverlayVisibility() {
        if (mOverlayView == null || !mIsViewAttached) return;

        mOverlayView.post(new Runnable() {
            @Override
            public void run() {
                if (mOverlayView == null) return;
                if (sIsAppInForeground) {
                    mOverlayView.setVisibility(View.GONE);
                } else {
                    mOverlayView.setVisibility(View.VISIBLE);
                }
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        sInstance = null;

        if (mIsViewAttached && mOverlayView != null && mWindowManager != null) {
            try {
                mWindowManager.removeView(mOverlayView);
            } catch (Exception e) {
                Log.w(TAG, "Error removing overlay view in onDestroy", e);
            }
            mIsViewAttached = false;
            mOverlayView = null;
        }

        stopForeground(true);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }
}
