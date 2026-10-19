package tj.yovari.calls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import java.io.File

/** Запасная запись: пишет разговор через микрофон (нужна громкая связь). Работает не на всех телефонах. */
class MicService : Service() {
    private var rec: MediaRecorder? = null
    private var file: File? = null

    override fun onBind(i: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) { finish(); return START_NOT_STICKY }
        startForegroundNow()
        if (rec == null) begin()
        return START_NOT_STICKY
    }

    private fun startForegroundNow() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val b: Notification.Builder
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel("rec", "Запись разговора", NotificationManager.IMPORTANCE_LOW))
            b = Notification.Builder(this, "rec")
        } else b = Notification.Builder(this)
        val n = b.setContentTitle("Идёт запись разговора").setSmallIcon(android.R.drawable.ic_btn_speak_now).build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE) else startForeground(7, n)
    }

    private fun begin() {
        try {
            val dir = File(getExternalFilesDir(null), "calls"); dir.mkdirs()
            val f = File(dir, "call_" + System.currentTimeMillis() + ".m4a")
            val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(this) else @Suppress("DEPRECATION") MediaRecorder()
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioEncodingBitRate(64000); r.setAudioSamplingRate(16000)
            r.setOutputFile(f.absolutePath)
            r.prepare(); r.start()
            rec = r; file = f
        } catch (e: Exception) { Store.log(this, "микрофон: " + e.message); rec = null; stopSelf() }
    }

    private fun finish() {
        try { rec?.stop() } catch (e: Exception) { file?.delete() }
        try { rec?.release() } catch (e: Exception) {}
        rec = null
        stopForeground(true); stopSelf()
        UploadJob.runNow(this)
    }

    override fun onDestroy() { try { rec?.release() } catch (e: Exception) {}; super.onDestroy() }

    companion object { const val START = "tj.yovari.calls.START"; const val STOP = "tj.yovari.calls.STOP" }
}
