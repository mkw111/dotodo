package com.dotodo.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews

class TodayWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    renderAll(context)
    refresh(context)
  }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    renderAll(context)
  }
  override fun onDeleted(context: Context, ids: IntArray) {
    val editor = context.getSharedPreferences("dotodo-widget", Context.MODE_PRIVATE).edit()
    ids.forEach { editor.remove("category:$it") }
    editor.apply()
  }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_REFRESH, Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> {
        refresh(context)
      }
      ACTION_ITEM -> {
        val task = intent.getStringExtra("taskId") ?: return
        if (intent.getBooleanExtra("complete", false)) {
          refresh(context, task)
        } else openApp(context, "task", task)
      }
    }
  }
  companion object {
    const val ACTION_REFRESH = "com.dotodo.widget.REFRESH"
    const val ACTION_ITEM = "com.dotodo.widget.ITEM"
    fun ids(context: Context): IntArray = AppWidgetManager.getInstance(context)
      .getAppWidgetIds(ComponentName(context, TodayWidget::class.java))
    fun openApp(context: Context, action: String, task: String = "") {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      context.startActivity(routeIntent(intent, action, task))
    }
    fun routeIntent(intent: Intent, action: String, task: String = "", category: String = "all"): Intent {
      // React Native Linking delivers deep links only for VIEW intents.
      intent.action = Intent.ACTION_VIEW
      intent.removeCategory(Intent.CATEGORY_LAUNCHER)
      intent.data = Uri.Builder().scheme("dotodo").authority("widget").appendPath(action)
        .appendQueryParameter("task", task).appendQueryParameter("category", category).build()
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      return intent
    }
    private fun appIntent(context: Context, action: String, category: String = "all"): PendingIntent {
      val launch = routeIntent(requireNotNull(context.packageManager.getLaunchIntentForPackage(context.packageName)), action, category = category)
      return PendingIntent.getActivity(context, (action + category).hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    fun refresh(context: Context, taskId: String? = null) {
      if (ids(context).isEmpty()) return
      try {
        if (taskId != null) WidgetStore.update(context) { session ->
          if (session.has("password")) {
            val pending = session.optJSONArray("pending") ?: org.json.JSONArray()
            if ((0 until pending.length()).none { pending.getString(it) == taskId }) pending.put(taskId)
            session.put("pending", pending)
          }
        }
        context.getSharedPreferences("dotodo-widget", Context.MODE_PRIVATE).edit()
          .putString("status", if (taskId == null) "동기화 대기 중…" else "완료 저장 대기 · 연결되면 반영돼요").apply()
        WidgetSyncJob.enqueue(context)
        renderAll(context)
      } catch (_: Exception) {
        context.getSharedPreferences("dotodo-widget", Context.MODE_PRIVATE).edit().putString("status", "위젯 저장 실패 · 앱을 열어 주세요").apply()
        renderAll(context)
      }
    }
    @Suppress("DEPRECATION")
    fun renderAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val preferences = context.getSharedPreferences("dotodo-widget", Context.MODE_PRIVATE)
      val session = try { WidgetStore.read(context) } catch (_: Exception) { org.json.JSONObject() }
      val snapshot = session.optJSONObject("snapshot")
      for (id in ids(context)) {
        val category = preferences.getString("category:$id", "all") ?: "all"
        val tasks = WidgetData.tasks(snapshot, category)
        val done = tasks.count { it.optBoolean("completed") }
        val views = RemoteViews(context.packageName, R.layout.today_widget)
        val date = WidgetData.today().substring(5).replace('-', '/')
        views.setTextViewText(R.id.widget_title, "오늘 · $date")
        val status = when {
          !session.has("password") -> "앱에서 로그인해 주세요"
          preferences.contains("status") -> preferences.getString("status", "")
          snapshot == null -> "불러오는 중…"
          else -> "$done/${tasks.size} 완료 · ${if (category == "all") "전체" else categoryName(snapshot, category)}"
        }
        views.setTextViewText(R.id.widget_status, status)
        views.setTextViewText(R.id.widget_empty, if (session.has("password")) "오늘 할 일이 없어요" else "앱을 열어 로그인해 주세요")
        views.setOnClickPendingIntent(R.id.widget_title, appIntent(context, "today", category))
        views.setOnClickPendingIntent(R.id.widget_empty, appIntent(context, "today"))
        views.setOnClickPendingIntent(R.id.widget_add, appIntent(context, "add", category))
        val refresh = Intent(context, TodayWidget::class.java).setAction(ACTION_REFRESH)
        views.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(context, id, refresh, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        val adapter = Intent(context, TaskCollectionService::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        adapter.data = Uri.parse("dotodo://widget/collection/$id")
        views.setRemoteAdapter(R.id.widget_list, adapter)
        views.setEmptyView(R.id.widget_list, R.id.widget_empty)
        val template = Intent(context, TodayWidget::class.java).setAction(ACTION_ITEM)
        val mutable = if (android.os.Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
        views.setPendingIntentTemplate(R.id.widget_list, PendingIntent.getBroadcast(context, id, template, PendingIntent.FLAG_UPDATE_CURRENT or mutable))
        manager.updateAppWidget(id, views)
        manager.notifyAppWidgetViewDataChanged(id, R.id.widget_list)
      }
    }
    fun categoryName(snapshot: org.json.JSONObject?, id: String): String {
      if (id == "inbox") return "수집함"
      val lists = snapshot?.optJSONObject("data")?.optJSONArray("lists") ?: return "카테고리"
      for (i in 0 until lists.length()) if (lists.getJSONObject(i).optString("id") == id) return lists.getJSONObject(i).optString("name")
      return "삭제된 카테고리"
    }
  }
}
