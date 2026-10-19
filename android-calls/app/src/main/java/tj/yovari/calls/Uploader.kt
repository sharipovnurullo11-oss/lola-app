package tj.yovari.calls

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object Uploader {
    private val lock = Any()

    private fun sha256(ctx: Context, uri: Uri): String? {
        return try {
            val md = MessageDigest.getInstance("SHA-256")
            ctx.contentResolver.openInputStream(uri)?.use { s -> val b = ByteArray(32 * 1024); while (true) { val n = s.read(b); if (n < 0) break; md.update(b, 0, n) } } ?: return null
            md.digest().joinToString("") { "%02x".format(it) }
        } catch (e: Exception) { null }
    }

    private fun iso(ms: Long): String { val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US); f.timeZone = TimeZone.getTimeZone("UTC"); return f.format(Date(ms)) }

    private fun deleteIt(ctx: Context, r: Rec) {
        try {
            when (r.kind) {
                "mic" -> File(r.uri.path ?: return).delete()
                "saf" -> DocumentsContract.deleteDocument(ctx.contentResolver, r.uri)
                else -> try { if (ctx.contentResolver.delete(r.uri, null, null) <= 0) throw SecurityException() } catch (e: SecurityException) {
                    Store.setPendingDelete(ctx, Store.pendingDelete(ctx) + r.uri.toString())
                }
            }
        } catch (e: Exception) { Store.log(ctx, "не удалил ${r.name}: ${e.message}") }
    }

    /** Отправляет новые записи. Файл удаляется только после ответа сервера ok и совпадения размера. */
    fun run(ctx: Context): String {
        synchronized(lock) {
            val sid = Store.sid(ctx)
            if (sid.isEmpty()) return "Нет входа"
            val sent = Store.sent(ctx)
            val now = System.currentTimeMillis()
            var ok = 0; var fail = 0; var skip = 0
            for (r in Scanner.candidates(ctx)) {
                if (sent.contains(r.key)) { skip++; continue }
                if (now - r.modifiedMs < 90000L) continue // файл ещё пишется
                val hash = sha256(ctx, r.uri)
                if (hash == null) { fail++; continue }
                val ci = Scanner.findCall(ctx, r.modifiedMs)
                val meta = JSONObject()
                meta.put("name", r.name).put("folder", r.folder).put("size", r.size).put("sha256", hash).put("source", r.kind)
                meta.put("brand", Build.MANUFACTURER).put("model", Build.MODEL).put("android", Build.VERSION.RELEASE)
                meta.put("fileAt", iso(r.modifiedMs))
                if (ci != null) {
                    meta.put("number", ci.number).put("startedAt", iso(ci.startMs)).put("durationSec", ci.durSec)
                    meta.put("direction", when (ci.type) { 1 -> "in"; 2 -> "out"; 3 -> "missed"; else -> "other" })
                }
                val stream = ctx.contentResolver.openInputStream(r.uri)
                if (stream == null) { fail++; continue }
                val res = stream.use { Api.upload(sid, meta, r.name, "application/octet-stream", it) }
                if (res.optBoolean("ok") && (res.optBoolean("dup") || res.optLong("size", -1) == r.size)) {
                    Store.markSent(ctx, r.key); ok++; deleteIt(ctx, r)
                } else { fail++; Store.log(ctx, "отправка ${r.name}: " + res.optString("error", "размер не совпал")) }
            }
            val msg = "Отправлено: $ok, ошибок: $fail, уже было: $skip"
            Store.log(ctx, msg); return msg
        }
    }
}
