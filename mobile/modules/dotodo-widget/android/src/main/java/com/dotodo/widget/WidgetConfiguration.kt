package com.dotodo.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import android.graphics.Color

class WidgetConfiguration : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setResult(RESULT_CANCELED)
    val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
    val ids = mutableListOf("all", "inbox")
    val names = mutableListOf("전체 카테고리", "수집함")
    val session = try { WidgetStore.read(this) } catch (_: Exception) { org.json.JSONObject() }
    val lists = session.optJSONObject("snapshot")?.optJSONObject("data")?.optJSONArray("lists")
    if (lists != null) for (i in 0 until lists.length()) {
      ids.add(lists.getJSONObject(i).getString("id"))
      names.add(lists.getJSONObject(i).getString("name"))
    }
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(48, 80, 48, 48)
      setBackgroundColor(Color.WHITE)
    }
    layout.addView(TextView(this).apply { text = "오늘 할 일 위젯"; textSize = 24f; setTextColor(Color.rgb(37,51,77)) })
    layout.addView(TextView(this).apply {
      text = if (session.has("password")) "표시할 카테고리를 선택하세요.\n매일 반복과 이월 설정은 앱과 같게 적용돼요."
        else "앱에서 먼저 로그인하면 할 일이 표시돼요."
      textSize = 15f; setPadding(0,32,0,32)
    })
    val preferences = getSharedPreferences("dotodo-widget", MODE_PRIVATE)
    val spinner = Spinner(this).apply {
      adapter = ArrayAdapter(this@WidgetConfiguration, android.R.layout.simple_spinner_dropdown_item, names)
      setSelection(ids.indexOf(preferences.getString("category:$id", "all")).coerceAtLeast(0))
    }
    layout.addView(spinner)
    layout.addView(Button(this).apply {
      text = "위젯 사용"
      setOnClickListener {
        preferences.edit().putString("category:$id", ids[spinner.selectedItemPosition]).apply()
        TodayWidget.renderAll(this@WidgetConfiguration)
        TodayWidget.refresh(this@WidgetConfiguration)
        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id))
        finish()
      }
    })
    setContentView(layout)
  }
}
