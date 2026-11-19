package com.dotodo.widget

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object WidgetData {
  fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
  private fun completedOn(task: JSONObject, date: String): Boolean {
    val value = task.optString("completedAt")
    for (pattern in listOf("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX")) {
      try {
        val parsed = SimpleDateFormat(pattern, Locale.US).parse(value) ?: continue
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(parsed) == date
      } catch (_: java.text.ParseException) { }
    }
    return false
  }
  fun tasks(snapshot: JSONObject?, category: String): List<JSONObject> {
    val data = snapshot?.optJSONObject("data") ?: return emptyList()
    val lists = data.optJSONArray("lists")
    val carry = mutableMapOf<String, Boolean>()
    if (lists != null) for (i in 0 until lists.length()) {
      val list = lists.getJSONObject(i)
      carry[list.getString("id")] = list.optBoolean("autoCarry", true)
    }
    val date = today()
    val array = data.optJSONArray("tasks") ?: return emptyList()
    return (0 until array.length()).map { array.getJSONObject(it) }.filter { task ->
      val start = task.optString("date")
      val end = task.optString("endDate", start)
      val scheduled = start.isNotEmpty() && start <= date && end >= date
      val visible = if (task.optBoolean("completed")) scheduled || completedOn(task, date)
        else scheduled || start.isNotEmpty() && end < date && task.optString("repeat") != "daily" && carry[task.optString("listId")] != false
      !task.optBoolean("actual") && task.isNull("deletedAt") &&
        (category == "all" || task.optString("listId") == category) && visible
    }
  }
  fun request(context: Context, taskId: String? = null): JSONObject {
    val session = WidgetStore.read(context)
    val base = session.optString("url")
    check(base == "https://www.save-time.kro.kr/dotodo/") { "앱에서 로그인해 주세요" }
    val path = if (taskId == null) "api/workspace/widget?day=${today()}" else
      "api/workspace/tasks/${java.net.URLEncoder.encode(taskId, "UTF-8")}/complete?day=${today()}"
    val connection = URL(base + path).openConnection() as HttpURLConnection
    try {
      connection.connectTimeout = 4000
      connection.readTimeout = 5000
      connection.instanceFollowRedirects = false
      val credentials = session.getString("username") + ":" + session.getString("password")
      connection.setRequestProperty("Authorization", "Basic " + Base64.encodeToString(credentials.toByteArray(Charsets.UTF_8), Base64.NO_WRAP))
      if (taskId != null) {
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
      }
      check(connection.responseCode != 401) { "로그인이 만료됐어요. 앱을 열어 주세요" }
      if (taskId != null && connection.responseCode == 404) return request(context)
      if (connection.responseCode !in 200..299) throw java.io.IOException("동기화 실패")
      return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
    } finally { connection.disconnect() }
  }
}
