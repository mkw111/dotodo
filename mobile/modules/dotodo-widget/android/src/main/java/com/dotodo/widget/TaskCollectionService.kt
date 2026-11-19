package com.dotodo.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONObject

class TaskCollectionService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = TaskFactory(applicationContext, intent)
}
private class TaskFactory(private val context: Context, intent: Intent) : RemoteViewsService.RemoteViewsFactory {
  private val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1)
  private var snapshot: JSONObject? = null
  private var tasks = emptyList<JSONObject>()
  override fun onCreate() = onDataSetChanged()
  override fun onDataSetChanged() {
    val session = try { WidgetStore.read(context) } catch (_: Exception) { JSONObject() }
    snapshot = if (session.has("password")) session.optJSONObject("snapshot") else null
    val category = context.getSharedPreferences("dotodo-widget", Context.MODE_PRIVATE).getString("category:$id", "all") ?: "all"
    tasks = WidgetData.tasks(snapshot, category).filter { !it.optBoolean("completed") }
      .sortedWith(compareBy<JSONObject> { val p = it.optInt("priority"); if (p == 0) 5 else p }
        .thenBy { it.optString("time", "99:99").ifEmpty { "99:99" } }.thenBy { it.optDouble("order") })
  }
  override fun getViewAt(position: Int): RemoteViews? {
    val task = tasks.getOrNull(position) ?: return null
    val views = RemoteViews(context.packageName, R.layout.widget_task)
    views.setTextViewText(R.id.task_title, task.optString("title"))
    val metadata = mutableListOf(TodayWidget.categoryName(snapshot, task.optString("listId")))
    if (task.optString("time").isNotEmpty()) metadata.add(task.getString("time"))
    if (task.optString("repeat") == "daily") metadata.add("매일")
    if (task.has("habitId")) metadata.add("습관 연동")
    if (task.optString("endDate", task.optString("date")) < WidgetData.today()) metadata.add("${task.optString("date").substring(5)}부터")
    val checklist = task.optJSONArray("checklist")
    if (checklist != null && checklist.length() > 0) {
      val checked = (0 until checklist.length()).count { checklist.getJSONObject(it).optBoolean("done") }
      metadata.add("$checked/${checklist.length()}")
    }
    views.setTextViewText(R.id.task_meta, metadata.joinToString(" · "))
    val priority = task.optInt("priority")
    views.setTextViewText(R.id.task_priority, if (priority > 0) "⚑$priority" else "")
    views.setTextColor(R.id.task_priority, Color.parseColor(listOf("#8793A8", "#DB646E", "#BD862D", "#5683CF", "#9471C4")[priority.coerceIn(0,4)]))
    views.setContentDescription(R.id.task_check, task.optString("title") + " 완료")
    views.setOnClickFillInIntent(R.id.task_check, Intent().putExtra("taskId", task.getString("id")).putExtra("complete", true))
    views.setOnClickFillInIntent(R.id.task_content, Intent().putExtra("taskId", task.getString("id")).putExtra("complete", false))
    return views
  }
  override fun getCount() = tasks.size
  override fun getViewTypeCount() = 1
  override fun getLoadingView(): RemoteViews? = null
  override fun getItemId(position: Int) = tasks.getOrNull(position)?.optString("id")?.hashCode()?.toLong() ?: 0L
  override fun hasStableIds() = false
  override fun onDestroy() { tasks = emptyList() }
}
