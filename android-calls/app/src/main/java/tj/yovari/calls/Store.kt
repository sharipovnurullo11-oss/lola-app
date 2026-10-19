package tj.yovari.calls

import android.content.Context

object Store {
    private fun p(c: Context) = c.getSharedPreferences("calls", Context.MODE_PRIVATE)
    fun sid(c: Context): String = p(c).getString("sid", "") ?: ""
    fun name(c: Context): String = p(c).getString("name", "") ?: ""
    fun setLogin(c: Context, sid: String, name: String) { p(c).edit().putString("sid", sid).putString("name", name).apply() }
    fun logout(c: Context) { p(c).edit().remove("sid").remove("name").apply() }
    fun did(c: Context): String {
        var d = p(c).getString("did", null)
        if (d == null) { d = "and" + java.lang.Long.toString(System.nanoTime(), 36) + (Math.random() * 1e9).toLong().toString(36); p(c).edit().putString("did", d).apply() }
        return d
    }
    fun tree(c: Context): String? = p(c).getString("tree", null)
    fun setTree(c: Context, u: String?) { p(c).edit().putString("tree", u).apply() }
    fun mic(c: Context): Boolean = p(c).getBoolean("mic", false)
    fun setMic(c: Context, v: Boolean) { p(c).edit().putBoolean("mic", v).apply() }
    fun sent(c: Context): Set<String> = p(c).getStringSet("sent", emptySet()) ?: emptySet()
    fun markSent(c: Context, key: String) {
        val s = HashSet(sent(c)); s.add(key)
        // храним не больше 3000 последних ключей
        val l = if (s.size > 3000) s.toList().takeLast(3000).toHashSet() else s
        p(c).edit().putStringSet("sent", l).apply()
    }
    fun pendingDelete(c: Context): Set<String> = p(c).getStringSet("pdel", emptySet()) ?: emptySet()
    fun setPendingDelete(c: Context, s: Set<String>) { p(c).edit().putStringSet("pdel", HashSet(s)).apply() }
    @Synchronized fun log(c: Context, line: String) {
        val t = java.text.SimpleDateFormat("dd.MM HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        val old = (p(c).getString("log", "") ?: "").split("\n").filter { it.isNotBlank() }
        p(c).edit().putString("log", (old + "$t $line").takeLast(40).joinToString("\n")).apply()
    }
    fun logText(c: Context): String = p(c).getString("log", "") ?: ""
}
