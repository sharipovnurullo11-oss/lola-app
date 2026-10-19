package tj.yovari.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager

class PhoneStateReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (!Store.mic(c) || Store.sid(c).isEmpty()) return
        val state = i.getStringExtra(TelephonyManager.EXTRA_STATE)
        try {
            if (state == TelephonyManager.EXTRA_STATE_OFFHOOK) {
                val s = Intent(c, MicService::class.java).setAction(MicService.START)
                if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s) else c.startService(s)
            } else if (state == TelephonyManager.EXTRA_STATE_IDLE) {
                c.startService(Intent(c, MicService::class.java).setAction(MicService.STOP))
            }
        } catch (e: Exception) { Store.log(c, "запись микрофона не стартовала: " + e.message) }
    }
}
