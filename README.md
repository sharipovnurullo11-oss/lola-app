# Приложение подключения ассистента — этап 1 (каркас)
Регистрация/вход, русский/таджикский/узбекский, кабинет-заглушка, PWA, Postgres, Docker+Traefik.
Тест: `npm test` (память, без базы). Запуск на сервере:
1. Скопировать папку на VPS, `cp .env.example .env`, заполнить.
2. Traefik на сервере: websecure + certresolver letsencrypt (уже вписано в compose).
3. `docker compose up -d --build`; открыть https://app.nurullo-sharipov.tech
Позже: argon2 вместо scrypt, лимит регистраций, оплата (этап 2).


Выкладка: после слияния в main GitHub Actions собирает образ, а Watchtower на сервере сам обновляет приложение (настроено 22.10.2026).
