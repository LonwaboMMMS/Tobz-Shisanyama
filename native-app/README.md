# Tobz Shisanyama — Native Android app

This is a separate Kotlin + Jetpack Compose Android application. It does not load the website in a WebView.

## Offline behaviour
- Home, menu, prices, weight calculations and the shopping bag are built into the APK.
- The shopping bag is saved locally on the device.
- The app can open and be used to prepare an order without internet.
- Submitting an order calls the existing `/api/place-order` endpoint and requires internet.
- Yoco payment opens in the browser and requires internet.

## Build locally
Open the `native-app` folder in Android Studio, allow Gradle sync, then choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Automated APK
GitHub Actions builds a signed debug APK whenever files in `native-app/` change on `main`. It publishes the file as the latest release asset:
`https://github.com/LonwaboMMMS/Tobz-Shisanyama/releases/latest/download/tobz-shisanyama.apk`

For a public production release, configure a private release keystore and signing secrets. Do not commit signing keys or passwords to this repository.

## Download page
The unlisted page is `/native-download/`. The no-index setting discourages search engines but does not password-protect the page. Anyone with the URL can open it. Use Cloudflare Access if actual access control is required.
