package tj.yovari.calls

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context

class UploadJob : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        Thread { try { Uploader.run(applicationContext) } catch (e: Exception) { Store.log(applicationContext, "job: " + e.message) }; jobFinished(params, false) }.start()
        return true
    }
    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        fun schedule(ctx: Context) {
            val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
            val info = JobInfo.Builder(1, ComponentName(ctx, UploadJob::class.java))
                .setPeriodic(15 * 60 * 1000L).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).build()
            js.schedule(info)
        }
        fun runNow(ctx: Context) { val app = ctx.applicationContext; Thread { try { Uploader.run(app) } catch (e: Exception) { Store.log(app, "upload: " + e.message) } }.start() }
    }
}
