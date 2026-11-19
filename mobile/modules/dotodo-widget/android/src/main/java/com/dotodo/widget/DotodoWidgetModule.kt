package com.dotodo.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import org.json.JSONObject

class DotodoWidgetModule : Module() {
  private fun context(): Context = requireNotNull(appContext.reactContext).applicationContext
  override fun definition() = ModuleDefinition {
    Name("DotodoWidget")
    AsyncFunction("setSession") { url: String, username: String, password: String ->
      require(url == "https://www.save-time.kro.kr/dotodo/")
      val context = context()
      WidgetStore.update(context) {
        val sameAccount = it.optString("url") == url && it.optString("username") == username && it.optString("password") == password
        if (!sameAccount) {
          it.remove("snapshot")
          it.remove("pending")
          it.put("sessionId", java.util.UUID.randomUUID().toString())
        }
        it.put("url", url).put("username", username).put("password", password)
      }
      TodayWidget.refresh(context)
    }
    AsyncFunction("clearSession") {
      val context = context()
      WidgetSyncJob.cancel(context)
      WidgetStore.clear(context)
      TodayWidget.renderAll(context)
    }
    AsyncFunction("updateSnapshot") { serialized: String ->
      val context = context()
      val state = JSONObject(serialized)
      require(state.optInt("schema") == 2)
      WidgetStore.update(context) { it.put("snapshot", JSONObject().put("data", state)) }
      TodayWidget.renderAll(context)
    }
    AsyncFunction("refresh") { TodayWidget.refresh(context()) }
  }
}
