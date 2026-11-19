package com.dotodo.widget

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object WidgetStore {
  private const val alias = "dotodo.widget.v1"
  private fun file(context: Context) = File(context.noBackupFilesDir, "widget-session.enc")
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    return store.getKey(alias, null) as? SecretKey ?: KeyGenerator.getInstance("AES", "AndroidKeyStore").run {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
      generateKey()
    }
  }
  @Synchronized fun read(context: Context): JSONObject {
    val saved = file(context)
    if (!saved.exists()) return JSONObject()
    val envelope = JSONObject(saved.readText())
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)))
    return JSONObject(String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
  }
  @Synchronized fun update(context: Context, change: (JSONObject) -> Unit) {
    val data = read(context)
    change(data)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val envelope = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
      .put("data", Base64.encodeToString(cipher.doFinal(data.toString().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
    val temporary = File(context.noBackupFilesDir, "widget-session.tmp")
    temporary.writeText(envelope.toString())
    check(temporary.renameTo(file(context))) { "Cannot store widget session" }
  }
  @Synchronized fun clear(context: Context) {
    check(!file(context).exists() || file(context).delete()) { "Cannot clear widget session" }
    context.getSharedPreferences("dotodo-widget", Context.MODE_PRIVATE).edit().remove("status").apply()
  }
}
