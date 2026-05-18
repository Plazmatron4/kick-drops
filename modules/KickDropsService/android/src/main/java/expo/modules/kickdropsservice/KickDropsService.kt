package expo.modules.kickdropsservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class KickDropsService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var prefs: SharedPreferences
    private lateinit var nm: NotificationManager

    companion object {
        const val FG_NOTIFICATION_ID = 9001
        const val FG_CHANNEL_ID = "kick-drops-monitor"
        const val DROP_CHANNEL_ID = "drops-alarm"
        const val PREFS_NAME = "kick_drops_svc_prefs"
        const val PREFS_KEY = "notified_ids"
        const val API_URL = "https://web.kick.com/api/v1/drops/campaigns"
        const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        const val POLL_INTERVAL_MS = 15_000L
    }

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        nm = getSystemService(NotificationManager::class.java)
        createChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildForegroundNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                FG_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(FG_NOTIFICATION_ID, notification)
        }

        scope.launch {
            while (true) {
                try {
                    fetchAndNotify()
                } catch (_: Exception) {
                    // Silently retry next cycle
                }
                delay(POLL_INTERVAL_MS)
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        // Silent foreground monitor channel
        nm.createNotificationChannel(
            NotificationChannel(
                FG_CHANNEL_ID,
                "Kick Drops Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the app watching for new drops every 15 seconds"
                setSound(null, null)
            }
        )

        // Loud drop-alert channel with alarm sound + bypass DnD
        val soundUri = Uri.parse("android.resource://$packageName/raw/alarm")
        val audioAttr = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        nm.createNotificationChannel(
            NotificationChannel(
                DROP_CHANNEL_ID,
                "Drop Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 200, 300, 200, 300)
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(soundUri, audioAttr)
            }
        )
    }

    private fun buildForegroundNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, FG_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Kick Drops")
            .setContentText("Watching for new drops every 15s…")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setOngoing(true)
            .build()
    }

    private fun fetchAndNotify() {
        val conn = URL(API_URL).openConnection() as HttpsURLConnection
        conn.setRequestProperty("User-Agent", USER_AGENT)
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000

        val response = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
        conn.disconnect()

        val campaigns = JSONObject(response).getJSONArray("data")
        val notifiedIds = getNotifiedIds()
        val newIds = mutableListOf<String>()

        for (i in 0 until campaigns.length()) {
            val c = campaigns.getJSONObject(i)
            val id = c.getString("id")
            val status = c.getString("status")
            if (status == "active" && !notifiedIds.contains(id)) {
                val name = c.optString("name", "Drop")
                val game = c.optJSONObject("category")?.optString("name") ?: "Kick"
                sendDropAlert(id.hashCode(), name, game)
                newIds.add(id)
            }
        }

        if (newIds.isNotEmpty()) {
            markNotified(notifiedIds + newIds)
        }
    }

    private fun sendDropAlert(notifId: Int, name: String, game: String) {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, DROP_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        nm.notify(
            notifId,
            builder
                .setContentTitle("New Kick Drop!")
                .setContentText("$name \u2022 $game \u2014 tap to open")
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setAutoCancel(true)
                .build()
        )
    }

    private fun getNotifiedIds(): Set<String> {
        val raw = prefs.getString(PREFS_KEY, "") ?: ""
        return if (raw.isEmpty()) emptySet() else raw.split(",").toSet()
    }

    private fun markNotified(ids: Set<String>) {
        prefs.edit().putString(PREFS_KEY, ids.joinToString(",")).apply()
    }
}
