# ADR 0007: emergency contacts

- Статус: принято
- Дата: 2026-08-25

## Решение

- Emergency contact — семейная запись, а не пользователь и не family membership.
- Только активные партнёры семьи могут читать и изменять контакты.
- MVP хранит только имя, связь с семьёй, телефон и optional email; medical, school,
  custody и свободные sensitive notes не хранятся.
- Удаление означает reversible archive; все изменения аудитируются.
- При archive/dissolution семьи записи сохраняются вместе с shared family data.
