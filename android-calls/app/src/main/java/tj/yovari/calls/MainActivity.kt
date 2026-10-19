package tj.yovari.calls

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var loginBox: LinearLayout
    private lateinit var mainBox: LinearLayout
    private lateinit var who: TextView
    private lateinit var out: TextView

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun btn(text: String, onClick: () -> Unit): Button {
        val b = Button(this); b.text = text; b.isAllCaps = false; b.setOnClickListener { onClick() }
        b.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) }
        return b
    }
    private fun say(t: String) = runOnUiThread { status.text = t }

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        val root = LinearLayout(this); root.orientation = LinearLayout.VERTICAL; root.setPadding(dp(16), dp(24), dp(16), dp(24))
        val title = TextView(this); title.text = "Ёвари Звонки"; title.textSize = 22f; root.addView(title)
        status = TextView(this); status.setPadding(0, dp(8), 0, dp(8)); root.addView(status)

        loginBox = LinearLayout(this); loginBox.orientation = LinearLayout.VERTICAL
        val phone = EditText(this); phone.hint = "Телефон для входа"; phone.inputType = android.text.InputType.TYPE_CLASS_PHONE
        val pass = EditText(this); pass.hint = "Пароль"; pass.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        loginBox.addView(phone); loginBox.addView(pass)
        loginBox.addView(btn("Войти") { login(phone.text.toString().trim(), pass.text.toString()) })
        root.addView(loginBox)

        mainBox = LinearLayout(this); mainBox.orientation = LinearLayout.VERTICAL
        who = TextView(this); mainBox.addView(who)
        mainBox.addView(btn("1. Разрешить доступ") { askPerms() })
        mainBox.addView(btn("2. Проверка телефона") { check() })
        mainBox.addView(btn("Отправить записи сейчас") { sendNow() })
        mainBox.addView(btn("Выбрать папку с записями") {
            startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), 11)
        })
        mainBox.addView(btn("Освободить место (удалить отправленные)") { freeSpace() })
        mainBox.addView(btn("Проверить обновление") { update() })
        val mic = CheckBox(this); mic.text = "Запасная запись через микрофон (включайте громкую связь)"; mic.isChecked = Store.mic(this)
        mic.setOnCheckedChangeListener { _, v -> Store.setMic(this, v) }
        mainBox.addView(mic)
        mainBox.addView(btn("Выйти") { Store.logout(this); refresh() })
        root.addView(mainBox)

        out = TextView(this); out.textSize = 12f; out.setPadding(0, dp(12), 0, 0); root.addView(out)
        val sv = ScrollView(this); sv.addView(root); setContentView(sv)
        refresh()
    }

    override fun onResume() { super.onResume(); refresh() }

    private fun refresh() {
        val logged = Store.sid(this).isNotEmpty()
        loginBox.visibility = if (logged) View.GONE else View.VISIBLE
        mainBox.visibility = if (logged) View.VISIBLE else View.GONE
        who.text = "Оператор: " + Store.name(this) + "\n" + Build.MANUFACTURER + " " + Build.MODEL + ", Android " + Build.VERSION.RELEASE
        out.text = Store.logText(this)
        if (logged) UploadJob.schedule(this)
        status.text = if (logged) "Готово к работе" else "Войдите тем же телефоном и паролем, что и в Едином окне"
    }

    private fun login(phone: String, pass: String) {
        if (phone.isEmpty() || pass.isEmpty()) { say("Введите телефон и пароль"); return }
        say("Вхожу…")
        Thread {
            val j = Api.postJson("/staff", JSONObject().put("action", "login").put("phone", phone).put("pass", pass).put("did", Store.did(this)).put("device", Build.MANUFACTURER + " " + Build.MODEL + " (приложение звонков)"))
            runOnUiThread {
                if (j.optBoolean("ok")) { Store.setLogin(this, j.optString("sid"), j.optString("name")); refresh() }
                else say(j.optString("error", "Не удалось войти") + (if (j.optBoolean("pending")) "\nНажмите «Войти» ещё раз после одобрения." else ""))
            }
        }.start()
    }

    private fun askPerms() {
        val p = ArrayList<String>()
        p.add(Manifest.permission.READ_CALL_LOG); p.add(Manifest.permission.READ_PHONE_STATE); p.add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) { p.add(Manifest.permission.READ_MEDIA_AUDIO); p.add(Manifest.permission.POST_NOTIFICATIONS) } else p.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        requestPermissions(p.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }.toTypedArray().ifEmpty { arrayOf(Manifest.permission.READ_CALL_LOG) }, 10)
        say("Разрешите всё, о чём спросит телефон")
    }

    private fun check() {
        say("Проверяю телефон…")
        Thread {
            val r = Scanner.report(this)
            val res = Api.postJson("/calls", JSONObject().put("action", "check").put("sid", Store.sid(this)).put("report", r))
            val sb = StringBuilder()
            sb.append(r.optString("brand")).append(" ").append(r.optString("model")).append(", Android ").append(r.optString("android")).append("\n")
            val n = r.optInt("callFiles")
            sb.append(if (n > 0) "Записи звонков найдены: $n\n" else "Записей звонков НЕ найдено\n")
            val fa = r.optJSONArray("folders")
            if (fa != null) for (i in 0 until fa.length()) sb.append(" • ").append(fa.getJSONObject(i).optString("folder")).append(": ").append(fa.getJSONObject(i).optInt("count")).append("\n")
            sb.append("Журнал звонков доступен: ").append(if (r.optBoolean("callLogOk")) "да" else "нет").append("\n")
            if (n == 0) sb.append("Включите запись звонков в приложении «Телефон», сделайте тестовый звонок и повторите. Если такой функции нет, включите запасную запись через микрофон.\n")
            sb.append(if (res.optBoolean("ok")) "Результат отправлен руководителю" else "Результат не отправлен: " + res.optString("error"))
            say(sb.toString())
        }.start()
    }

    private fun sendNow() { say("Отправляю…"); Thread { val m = Uploader.run(this); say(m); runOnUiThread { out.text = Store.logText(this) } }.start() }

    private fun freeSpace() {
        val uris = Store.pendingDelete(this).map { Uri.parse(it) }
        if (uris.isEmpty()) { say("Нечего удалять"); return }
        if (Build.VERSION.SDK_INT >= 30) {
            val pi = MediaStore.createDeleteRequest(contentResolver, uris)
            startIntentSenderForResult(pi.intentSender, 12, null, 0, 0, 0)
        } else say("На этом Android файлы удаляются сразу после отправки")
    }

    private fun update() {
        say("Проверяю версию…")
        Thread {
            val j = Api.postJson("/calls", JSONObject().put("action", "version").put("sid", Store.sid(this)))
            val mine = if (Build.VERSION.SDK_INT >= 28) packageManager.getPackageInfo(packageName, 0).longVersionCode else 0L
            val v = j.optLong("version", 0)
            runOnUiThread {
                if (v > mine && j.optString("url").startsWith("https://")) { say("Есть новая версия $v. Открываю ссылку."); startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(j.optString("url")))) }
                else say("Установлена последняя версия ($mine)")
            }
        }.start()
    }

    override fun onActivityResult(req: Int, res: Int, data: Intent?) {
        super.onActivityResult(req, res, data)
        if (req == 11 && res == RESULT_OK && data?.data != null) {
            contentResolver.takePersistableUriPermission(data.data!!, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            Store.setTree(this, data.data.toString()); say("Папка выбрана")
        }
        if (req == 12 && res == RESULT_OK) { Store.setPendingDelete(this, emptySet()); say("Отправленные записи удалены") }
    }
}
