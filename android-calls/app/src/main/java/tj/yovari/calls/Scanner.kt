package tj.yovari.calls

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.CallLog
import android.provider.DocumentsContract
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Rec(val key: String, val uri: Uri, val name: String, val folder: String, val size: Long, val modifiedMs: Long, val kind: String)
data class CallInfo(val number: String, val type: Int, val startMs: Long, val durSec: Long)

object Scanner {
    // Слова в пути или имени, по которым узнаём записи звонков у разных марок.
    private val STRICT = listOf("call", "phonerecord", "callrec", "звон")
    private val BROAD = listOf("call", "record", "rec", "voice", "звон", "phone")

    private fun audioRows(ctx: Context): List<Rec> {
        val out = ArrayList<Rec>()
        val col = if (Build.VERSION.SDK_INT >= 29) "relative_path" else MediaStore.Audio.Media.DATA
        val proj = arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.SIZE, MediaStore.Audio.Media.DATE_MODIFIED, col)
        try {
            ctx.contentResolver.query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, proj, null, null, MediaStore.Audio.Media.DATE_MODIFIED + " DESC")?.use { c ->
                var n = 0
                while (c.moveToNext() && n < 5000) {
                    n++
                    val id = c.getLong(0); val name = c.getString(1) ?: ""; val size = c.getLong(2); val mod = c.getLong(3) * 1000
                    var folder = c.getString(4) ?: ""
                    if (Build.VERSION.SDK_INT < 29) folder = File(folder).parent ?: ""
                    val uri = Uri.withAppendedPath(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id.toString())
                    out.add(Rec("m:$id", uri, name, folder, size, mod, "builtin"))
                }
            }
        } catch (e: Exception) { Store.log(ctx, "MediaStore: " + e.message) }
        return out
    }

    private fun isCall(r: Rec, words: List<String>): Boolean {
        val f = r.folder.lowercase(); val n = r.name.lowercase()
        return words.any { f.contains(it) || n.startsWith(it) }
    }

    private fun micFiles(ctx: Context): List<Rec> {
        val dir = File(ctx.getExternalFilesDir(null), "calls")
        val files = dir.listFiles() ?: return emptyList()
        return files.filter { it.isFile && it.length() > 0 }.map { Rec("f:" + it.absolutePath, Uri.fromFile(it), it.name, "mic", it.length(), it.lastModified(), "mic") }
    }

    private fun safFiles(ctx: Context): List<Rec> {
        val t = Store.tree(ctx) ?: return emptyList()
        val tree = Uri.parse(t)
        val out = ArrayList<Rec>()
        fun walk(docId: String, depth: Int, path: String) {
            if (depth > 3) return
            val kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId)
            try {
                ctx.contentResolver.query(kids, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED), null, null, null)?.use { c ->
                    while (c.moveToNext()) {
                        val id = c.getString(0); val name = c.getString(1) ?: ""; val mime = c.getString(2) ?: ""
                        if (mime == DocumentsContract.Document.MIME_TYPE_DIR) walk(id, depth + 1, "$path/$name")
                        else if (mime.startsWith("audio") || name.lowercase().let { it.endsWith(".amr") || it.endsWith(".m4a") || it.endsWith(".mp3") || it.endsWith(".3gp") || it.endsWith(".wav") || it.endsWith(".awb") || it.endsWith(".aac") })
                            out.add(Rec("s:$id", DocumentsContract.buildDocumentUriUsingTree(tree, id), name, path, c.getLong(3), c.getLong(4), "saf"))
                    }
                }
            } catch (e: Exception) { Store.log(ctx, "папка: " + e.message) }
        }
        walk(DocumentsContract.getTreeDocumentId(tree), 0, "выбранная папка")
        return out
    }

    /** Все записи звонков, которые нужно отправить (штатные по MediaStore, из выбранной папки и микрофонные). */
    fun candidates(ctx: Context): List<Rec> {
        val all = ArrayList<Rec>()
        all.addAll(audioRows(ctx).filter { isCall(it, STRICT) })
        all.addAll(safFiles(ctx)); all.addAll(micFiles(ctx))
        return all.distinctBy { it.key }
    }

    fun findCall(ctx: Context, modifiedMs: Long): CallInfo? {
        return try {
            var best: CallInfo? = null; var bestD = Long.MAX_VALUE
            ctx.contentResolver.query(CallLog.Calls.CONTENT_URI, arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION),
                CallLog.Calls.DATE + " BETWEEN ? AND ?", arrayOf((modifiedMs - 4 * 3600000L).toString(), (modifiedMs + 300000L).toString()), CallLog.Calls.DATE + " DESC")?.use { c ->
                while (c.moveToNext()) {
                    val ci = CallInfo(c.getString(0) ?: "", c.getInt(1), c.getLong(2), c.getLong(3))
                    val d = Math.abs(ci.startMs + ci.durSec * 1000 - modifiedMs)
                    if (d < bestD) { bestD = d; best = ci }
                }
            }
            if (best != null && bestD <= 180000L) best else null
        } catch (e: SecurityException) { null } catch (e: Exception) { null }
    }

    /** Отчёт для экрана «Проверка телефона». */
    fun report(ctx: Context): JSONObject {
        val r = JSONObject()
        r.put("brand", Build.MANUFACTURER).put("model", Build.MODEL).put("android", Build.VERSION.RELEASE).put("sdk", Build.VERSION.SDK_INT)
        r.put("display", Build.DISPLAY)
        val rows = audioRows(ctx)
        val folders = LinkedHashMap<String, Int>()
        for (x in rows.filter { isCall(it, BROAD) }) folders[x.folder] = (folders[x.folder] ?: 0) + 1
        val fa = JSONArray(); folders.entries.sortedByDescending { it.value }.take(12).forEach { fa.put(JSONObject().put("folder", it.key).put("count", it.value)) }
        val strict = rows.filter { isCall(it, STRICT) }
        r.put("folders", fa).put("callFiles", strict.size).put("mic", Store.mic(ctx)).put("micFiles", micFiles(ctx).size)
        r.put("safFiles", safFiles(ctx).size).put("safChosen", Store.tree(ctx) != null)
        strict.firstOrNull()?.let { r.put("newest", JSONObject().put("name", it.name).put("folder", it.folder).put("at", it.modifiedMs)) }
        r.put("callLogOk", try { ctx.contentResolver.query(CallLog.Calls.CONTENT_URI, arrayOf(CallLog.Calls._ID), null, null, null)?.use { true } ?: false } catch (e: Exception) { false })
        return r
    }
}
