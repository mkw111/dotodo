package com.dotodo.widget

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.widget.RemoteViews
import android.widget.TextView
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WidgetIntegrationTest {
  @Test fun encryptedSessionAndFilteringAndLayout() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val context = instrumentation.targetContext
    WidgetStore.clear(context)
    val today = WidgetData.today()
    val yesterday = java.time.LocalDate.parse(today).minusDays(1).toString()
    val tomorrow = java.time.LocalDate.parse(today).plusDays(1).toString()
    val data = JSONObject("""{"lists":[{"id":"faith","name":"신앙","autoCarry":false},{"id":"contact","name":"연락","autoCarry":true}],"tasks":[]} """)
    fun task(id: String, category: String, date: String, repeat: String = "none") = JSONObject()
      .put("id", id).put("title", id).put("listId", category).put("date", date)
      .put("repeat", repeat).put("completed", false).put("deletedAt", JSONObject.NULL)
    val tasks = data.getJSONArray("tasks")
    tasks.put(task("faith-today", "faith", today))
    tasks.put(task("faith-old", "faith", yesterday))
    tasks.put(task("contact-old", "contact", yesterday))
    tasks.put(task("daily-old", "contact", yesterday, "daily"))
    tasks.put(task("future", "contact", tomorrow))
    tasks.put(task("actual", "contact", today).put("actual", true))
    tasks.put(task("deleted", "contact", today).put("deletedAt", "2026-01-01T00:00:00Z"))
    tasks.put(task("completed-old", "contact", yesterday).put("completed", true)
      .put("completedAt", "2026-01-01T00:00:00Z"))
    val snapshot = JSONObject().put("data", data)
    WidgetStore.update(context) {
      it.put("password", "only-a-test-password").put("snapshot", snapshot)
    }
    assertEquals("only-a-test-password", WidgetStore.read(context).getString("password"))
    val file = java.io.File(context.noBackupFilesDir, "widget-session.enc").readText()
    assertFalse(file.contains("only-a-test-password"))
    assertFalse(file.contains("faith-today"))
    assertEquals(listOf("faith-today", "contact-old"), WidgetData.tasks(snapshot, "all").map { it.getString("id") })
    assertEquals(listOf("faith-today"), WidgetData.tasks(snapshot, "faith").map { it.getString("id") })
    instrumentation.runOnMainSync {
      val remote = RemoteViews(context.packageName, R.layout.today_widget)
      remote.setTextViewText(R.id.widget_title, "오늘 · 위젯 테스트")
      val rendered = remote.apply(context, null)
      assertEquals("오늘 · 위젯 테스트", rendered.findViewById<TextView>(R.id.widget_title).text.toString())
      RemoteViews(context.packageName, R.layout.widget_task).apply(context, null)
    }
    WidgetStore.clear(context)
    assertEquals(0, WidgetStore.read(context).length())
  }
}
