package com.dotodo.widget

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import org.json.JSONArray
import java.util.concurrent.Executors

class WidgetSyncJob : JobService() {
  private var cancellation = java.util.concurrent.atomic.AtomicBoolean(false)
  override fun onStartJob(params: JobParameters): Boolean {
    val cancelled = java.util.concurrent.atomic.AtomicBoolean(false)
    cancellation = cancelled
    executor.execute {
      var retry = false
      try {
        val original = WidgetStore.read(this)
        if (!original.has("password")) return@execute
        val sessionId = original.optString("sessionId")
        val pending = original.optJSONArray("pending") ?: JSONArray()
        var snapshot: org.json.JSONObject? = null
        for (i in 0 until pending.length()) {
          if (cancelled.get() || WidgetStore.read(this).optString("sessionId") != sessionId) return@execute
          val taskId = pending.getString(i)
          snapshot = WidgetData.request(this, taskId)
          expo.modules.notifications.service.NotificationsService.removeScheduledNotification(this, "dotodo-task:$taskId")
          WidgetStore.update(this) { current ->
            if (current.optString("sessionId") == sessionId) {
              val remaining = current.optJSONArray("pending") ?: JSONArray()
              current.put("pending", JSONArray((0 until remaining.length()).map { remaining.getString(it) }.filter { it != taskId }))
              current.put("snapshot", snapshot)
            }
          }
        }
        if (snapshot == null && !cancelled.get()) snapshot = WidgetData.request(this)
        WidgetStore.update(this) { current ->
          if (!cancelled.get() && current.optString("sessionId") == sessionId && current.has("password")) current.put("snapshot", snapshot)
          retry = current.optJSONArray("pending")?.length()?.let { it > 0 } ?: false
        }
        getSharedPreferences("dotodo-widget", MODE_PRIVATE).edit().remove("status").apply()
      } catch (error: Exception) {
        retry = error !is IllegalStateException
        val message = if (retry) "연결 대기 · 자동으로 다시 시도해요" else error.message
        getSharedPreferences("dotodo-widget", MODE_PRIVATE).edit().putString("status", message).apply()
      } finally {
        TodayWidget.renderAll(this)
        if (!cancelled.get()) jobFinished(params, retry)
      }
    }
    return true
  }
  override fun onStopJob(params: JobParameters): Boolean { cancellation.set(true); return true }
  companion object {
    private const val JOB_ID = 194021
    private val executor = Executors.newSingleThreadExecutor()
    fun enqueue(context: Context) {
      val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
      if (scheduler.getPendingJob(JOB_ID) != null) return
      val job = JobInfo.Builder(JOB_ID, ComponentName(context, WidgetSyncJob::class.java))
        .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
        .setBackoffCriteria(30000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build()
      check(scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS) { "Cannot schedule widget sync" }
    }
    fun cancel(context: Context) {
      (context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).cancel(JOB_ID)
    }
  }
}
