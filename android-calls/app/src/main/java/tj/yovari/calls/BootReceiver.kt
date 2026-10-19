package tj.yovari.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { if (Store.sid(c).isNotEmpty()) UploadJob.schedule(c) }
}
