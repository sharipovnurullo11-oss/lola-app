plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
val vcode = (System.getenv("BUILD_NUMBER") ?: "1").toInt()
android {
    namespace = "tj.yovari.calls"
    compileSdk = 34
    defaultConfig {
        applicationId = "tj.yovari.calls"
        minSdk = 24
        targetSdk = 34
        versionCode = vcode
        versionName = "0.1.$vcode"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
