# ABO → PRO, End-to-End-Aufnahmen

Lokale Anwendung `http://localhost:3000`, lokale Datenbank, Stripe-Testmodus.
Keine Produktionsdaten, keine echten Zahlungen.

Die Bilder sind Viewport-Aufnahmen von Headless Chrome.
Desktop ist 1440 × 900, Mobil ist 390 × 844.
Ein schwarzes „N“ unten links ist die lokale Next.js-Entwicklungsmarke, nicht Teil der Seite.

Testkonten:

| Konto | Rolle |
| --- | --- |
| e2e-main-20261016@example.com | Kostenlos, dann ABO, dann PRO |
| e2e-cancel-20261016@example.com | ABO gekündigt, Zeitraum noch gültig |
| e2e-quota-20261016@example.com | ABO mit 50 verwendeten Adressen |

## Desktop

### 01_free_tariffs.png

1440 × 900. Tarifseite direkt nach der Registrierung, vor dem ABO-Kauf.
Kostenlos ist der aktuelle Tarif. ABO kostet 29 € / Monat, PRO 59 € / Monat.
Beide Abschluss-Buttons sind sichtbar.

Ergebnis: Seite zeigt alle drei Tarife und Preise. Die E-Mail in der Kopfzeile wird mit Auslassung abgeschnitten.

### 02_abo_checkout.png

1440 × 900. Stripe Checkout für ABO, vor der Bezahlung.
Betrag 29,00 € pro Monat, Sandbox-Hinweis, E-Mail des Testkontos.
Die Kartenfelder erscheinen erst nach der Auswahl „Karte“.

Ergebnis: Betrag und Abo-Text sind vor der Zahlung sichtbar.

### 03_abo_account.png

1440 × 900. Mein Konto nach verarbeitetem `invoice.paid` für ABO.
ABO ist aktiv, 0 von 50 Adressen, bezahlt bis 16.11.2026, nächste Verlängerung am 16.11.2026.
Keine gespeicherten Berechnungen.

Ergebnis: Kontostand entspricht dem bezahlten ABO-Zeitraum.

### 04_abo_tariffs.png

1440 × 900. Tarifseite mit aktivem ABO.
ABO ist „Aktueller Tarif“, PRO bietet „Zu PRO wechseln“.

Ergebnis: Der sofortige Wechsel ist erreichbar. Der untere Bereich „Gut zu wissen“ liegt unterhalb des ersten Viewports.

### 05_upgrade_dialog.png

1440 × 900. Bestätigungsdialog, 0 von 50 Adressen verwendet.
Aktueller Tarif ABO, bezahlt bis 16.11.2026, noch 50 Adressen.
Neuer Tarif PRO — 59,00 €/Monat, 200 Adressen.
Vollständiger Hinweis einschließlich „Eine Erstattung erfolgt nicht.“
Buttons „Abbrechen“ und „Jetzt für 59,00 € zu PRO wechseln“.

Ergebnis: Der Dialog ist in diesem Viewport vollständig lesbar.

### 06_pro_checkout.png

1440 × 900. Stripe Checkout für PRO, vor der Bezahlung.
Betrag 59,00 € pro Monat, Sandbox-Hinweis.

Ergebnis: Betrag und PRO-Text sind vor der Zahlung sichtbar.

### 07_payment_processing.png

1440 × 900. Rückkehr auf `/tarife/erfolg` nach bezahltem PRO-Checkout.
`invoice.paid` war zu diesem Zeitpunkt noch nicht an die lokale Anwendung zugestellt.
Text: „Zahlung wird verarbeitet. Ihre Zahlung wird verarbeitet. Ihr neuer Tarif wird in Kürze aktiviert.“
„PRO ist aktiv“ erscheint nicht.

Ergebnis: Der Zustand kommt aus der laufenden Bestätigungsabfrage, nicht aus einem geänderten Text.

### 08_pro_activated.png

1440 × 900. Tarifseite nach Zustellung von `invoice.paid`.
PRO ist „Aktueller Tarif“. Es gibt keinen Button „Zu PRO wechseln“.

Ergebnis: PRO ist erst nach dem gespeicherten Zeitraum der aktuelle Tarif.

### 09_pro_account.png

1440 × 900. Mein Konto nach dem Wechsel.
PRO aktiv, 0 von 200 Adressen, bezahlt bis 16.11.2026, nächste Verlängerung am 16.11.2026.
Die Liste der Berechnungen ist weiterhin leer.

Ergebnis: Konto und Tarifseite zeigen denselben PRO-Zeitraum.

### 10_canceled_abo.png

1440 × 900. Konto `e2e-cancel-20261016@example.com`.
ABO ist bezahlt und in Stripe bereits `canceled`. Der Zeitraum läuft bis 16.11.2026.
Hinweis: „Abonnement gekündigt. Zugang bis 16.11.2026.“
Button „Zu PRO wechseln“ ist sichtbar.

Ergebnis: Ein gekündigtes, noch gültiges ABO bleibt der aktuelle Tarif und kann zu PRO wechseln.

### 11_canceled_upgrade_dialog.png

1440 × 900. Derselbe gekündigte ABO-Zeitraum, Dialog geöffnet.
0 von 50 Adressen, vollständiger Hinweis, beide Buttons.

Ergebnis: Der Dialog verwendet die Daten des gekündigten Zeitraums.

### 12_zero_addresses.png

1440 × 900. Konto `e2e-quota-20261016@example.com`.
Die 50 Adresszeilen wurden in der lokalen Tabelle `subscription_period_addresses` eingetragen.
Es wurden keine 50 vollständigen Berechnungen ausgeführt.
Der Dialog zeigt 50 von 50 Adressen und 0 Adressen verfügbar.
Die Sätze zur weiteren Nutzung der verbleibenden Adressen fehlen.
Der Hinweis auf den Verfall und „Eine Erstattung erfolgt nicht.“ bleibt stehen.

Ergebnis: Die Seite liest die gespeicherte Nutzung. Der Nutzungshinweis entfällt bei 0 verfügbaren Adressen.

### 13_checkout_canceled.png

1440 × 900. Rückkehr über den Zurück-Link des PRO-Checkouts auf `/tarife/abgebrochen`.
„Zahlung abgebrochen. Ihr bisheriger Tarif bleibt unverändert. Ein neuer Zeitraum wurde nicht freigeschaltet.“
Keine Erfolgsmeldung.

Ergebnis: Der Abbruch schaltet PRO nicht frei. Anschließend wurde ein neuer Checkout bezahlt.

## Mobil

### 15_mobile_tariffs.png

390 × 844. Tarifseite mit aktivem ABO.
Kostenlos und der Beginn von ABO sind sichtbar. PRO und „Zu PRO wechseln“ liegen unter dem ersten Viewport.
Kein horizontales Scrollen. Die lokale „N“-Marke überdeckt den unteren Rand von „Aktueller Tarif“.

### 16_mobile_upgrade_dialog.png

390 × 844. Dialog des gekündigten ABO-Kontos, ohne inneren Scroll.
Titel, Tarif, Datum, 0 von 50, Preis 59,00 € und beide Buttons sind sichtbar.
Der Warnhinweis ist unten abgeschnitten: „Sie können diese zunächst verwenden …“, der Verfall und „Eine Erstattung erfolgt nicht.“ liegen im scrollbaren Bereich des Dialogs.
Die Buttons bleiben vollständig sichtbar. `scrollWidth` ist 390.

### 17_mobile_pro_checkout.png

390 × 844. Dieselbe unbezahlte PRO-Checkout-Seite wie in 06.
59,00 € pro Monat ist sichtbar. Die E-Mail wird von Stripe gekürzt.
Der Button „Zahlungspflichtig abonnieren“ liegt unter dem ersten Viewport.
Kein horizontales Scrollen im sichtbaren Bereich.

### 18_mobile_pro_account.png

390 × 844. Mein Konto nach PRO.
PRO aktiv, 0 von 200 Adressen, Zeitraum und nächste Verlängerung am 16.11.2026.
Die Zeilen umbrechen innerhalb der Karte. Die lokale „N“-Marke liegt über dem unteren Rand von „Neue Berechnung“.

## Nicht aufgenommen

### 14_payment_error.png

Eine Testkarte wurde für den PRO-Checkout abgelehnt.
Stripe meldete `charge.failed`, die Sitzung blieb `unpaid`, und es entstand keine zweite bezahlte Rechnung.
Nach dem Neuladen zeigte die Checkout-Seite das Formular erneut, ohne eine sichtbare Fehlermeldung.
Die Kartenfelder liegen in einem Frame, der erst nach der Auswahl „Karte“ existiert; eine stabile Fehlermeldung im Formular ließ sich nicht aufnehmen.
Die Abbildung wurde deshalb nicht gespeichert. Der Text der Anwendung wurde nicht künstlich gesetzt.

## Technisches Ergebnis des Hauptkontos

- ABO-Rechnung: 29,00 €, einmal bezahlt.
- PRO-Rechnung: 59,00 €, einmal bezahlt.
- Eine abgelehnte Belastung, keine zweite erfolgreiche PRO-Abbuchung.
- Ein ABO-Zeitraum, Limit 50, unverändert.
- Ein PRO-Zeitraum, Limit 200, späterer Beginn.
- ABO-Subscription `canceled`.
- PRO-Subscription `active`.
- PRO wurde auf der Tarifseite erst nach `invoice.paid` als aktueller Tarif angezeigt.
- Das Konto hatte keine gespeicherten Berechnungen. Der leere Zustand blieb nach dem Wechsel leer. Ein vorhandener Bericht wurde mit diesem neuen Konto nicht geprüft.
