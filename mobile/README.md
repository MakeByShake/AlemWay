# Приложение AlemWay (Android)

Это оболочка, которая открывает живой сайт **alemway.kz** внутри приложения.
Отдельной копии данных нет: клиенты, документы, финансы и кабинеты приходят с сайта.
Поэтому **любое изменение сайта сразу появляется в приложении** — пересобирать его не нужно.

- Первый экран: `https://alemway.kz/app`, выбор «Я клиент / Я сотрудник» (кто уже вошёл, сразу попадает в кабинет или в «Чаты»). Личные ссылки клиентов `alemway.kz/c/…` можно открывать в приложении.
- Долгое нажатие на значок: ярлыки «Сайт», «Кабинет клиента», «Клиенты и документы».
- Загрузка файлов с телефона и камеры работает; PDF, Excel и ZIP скачиваются в «Загрузки».
- Ссылки на другие сайты, WhatsApp, телефон и почта открываются в своих приложениях.
- Без интернета показывается экран «Нет интернета».

## Сборка

APK собирает GitHub Actions (`.github/workflows/android-app.yml`) при каждом изменении
папки `mobile/` в ветке `app`, либо вручную: Actions → «Android-приложение AlemWay» → Run workflow.
Готовый файл `AlemWay.apk` лежит в артефактах запуска.

Локально (нужны Node 22, JDK 21, Android SDK):

```
cd mobile
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Что где менять

- Адрес первого экрана — `capacitor.config.json` → `server.url`.
- Ярлыки значка — `android/app/src/main/res/xml/shortcuts.xml`.
- Значок и заставка — `android/app/src/main/res/mipmap-*`, `drawable*/splash.png`.
- Скачивание файлов — `android/app/src/main/java/kz/alemway/app/MainActivity.java`.
