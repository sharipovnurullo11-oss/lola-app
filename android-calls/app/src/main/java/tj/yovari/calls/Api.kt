package tj.yovari.calls

import org.json.JSONObject
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

object Api {
    const val BASE = "https://n8n-ny7q.srv2033023.hstgr.cloud/webhook"

    private fun readAll(c: HttpURLConnection): JSONObject {
        val stream = if (c.responseCode in 200..299) c.inputStream else (c.errorStream ?: return JSONObject().put("ok", false).put("error", "http " + c.responseCode))
        val text = stream.bufferedReader().use { it.readText() }
        return try { JSONObject(text) } catch (e: Exception) { JSONObject().put("ok", false).put("error", "ответ не разобран (" + c.responseCode + ")") }
    }

    fun postJson(path: String, body: JSONObject): JSONObject {
        return try {
            val c = URL(BASE + path).openConnection() as HttpURLConnection
            c.requestMethod = "POST"; c.connectTimeout = 15000; c.readTimeout = 30000; c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(body.toString().toByteArray()) }
            readAll(c)
        } catch (e: Exception) { JSONObject().put("ok", false).put("error", "нет связи: " + (e.message ?: "")) }
    }

    /** Загрузка файла записи: multipart, поля sid и meta (JSON), файл file. */
    fun upload(sid: String, meta: JSONObject, fileName: String, mime: String, input: InputStream): JSONObject {
        return try {
            val boundary = "----yv" + System.nanoTime()
            val c = URL(BASE + "/calls").openConnection() as HttpURLConnection
            c.requestMethod = "POST"; c.connectTimeout = 20000; c.readTimeout = 120000; c.doOutput = true
            c.setChunkedStreamingMode(64 * 1024)
            c.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            c.outputStream.use { out ->
                fun field(n: String, v: String) {
                    out.write(("--$boundary\r\nContent-Disposition: form-data; name=\"$n\"\r\n\r\n$v\r\n").toByteArray())
                }
                field("action", "upload"); field("sid", sid); field("meta", meta.toString())
                out.write(("--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + fileName.replace("\"", "") + "\"\r\nContent-Type: $mime\r\n\r\n").toByteArray())
                val buf = ByteArray(32 * 1024)
                while (true) { val n = input.read(buf); if (n < 0) break; out.write(buf, 0, n) }
                out.write(("\r\n--$boundary--\r\n").toByteArray())
            }
            readAll(c)
        } catch (e: Exception) { JSONObject().put("ok", false).put("error", "нет связи: " + (e.message ?: "")) }
    }
}
