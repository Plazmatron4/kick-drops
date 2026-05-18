package expo.modules.kickdropsservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KickDropsServiceModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("KickDropsService")

        Function("startService") {
            val context = appContext.reactContext ?: return@Function
            val intent = Intent(context, KickDropsService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        Function("stopService") {
            val context = appContext.reactContext ?: return@Function
            context.stopService(Intent(context, KickDropsService::class.java))
        }
    }
}
