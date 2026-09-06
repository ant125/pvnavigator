import { MethodikArticle } from "@/components/methodik/MethodikArticle";
import { MethodikInfoBox } from "@/components/methodik/MethodikCallouts";
import { MethodikDownloadBox } from "@/components/methodik/MethodikDownloadBox";
import { MethodikFlowDiagram } from "@/components/methodik/MethodikFlowDiagram";
import { MethodikLineChart } from "@/components/methodik/MethodikLineChart";
import {
  MethodikKickerHeading,
  MethodikList,
  MethodikMinorHeading,
  MethodikP,
  MethodikSection,
  MethodikSubSection,
} from "@/components/methodik/MethodikSection";
import {
  MethodikCsvPreview,
  MethodikTable,
} from "@/components/methodik/MethodikTable";
import type { MethodikArticleMeta } from "@/lib/methodik/catalog";
import {
  EV_HOME_CHARGING_EXAMPLE_DOWNLOAD_PATH,
  EV_HOME_CHARGING_EXAMPLE_FILENAME,
  formatMethodikIsoDateDe,
  formatMethodikKwhDe,
  formatMethodikPreviewKwh,
  type MethodikCsvDocument,
} from "@/lib/methodik/exampleCsv";

function previewRows(example: MethodikCsvDocument) {
  const formatted = example.previewGroups.map((group) =>
    group.map((row) => [
      formatMethodikIsoDateDe(row.date),
      row.time,
      formatMethodikPreviewKwh(row.kwh),
    ])
  );
  const ellipsis = ["…", "…", "…"] as const;
  return [
    ...formatted[0],
    ellipsis,
    ...formatted[1],
    ellipsis,
    ...formatted[2],
  ];
}

export function ElektroautoLadeprofilArticle({
  article,
  example,
}: {
  article: MethodikArticleMeta;
  example: MethodikCsvDocument;
}) {
  const chartStart = formatMethodikIsoDateDe(example.week.startDate);
  const chartEnd = formatMethodikIsoDateDe(example.week.endDate);

  return (
    <MethodikArticle article={article}>
      <MethodikSection title="Zweck dieser Methodik">
        <MethodikP>
          Diese Methodik beschreibt das Berechnungsverfahren, mit dem
          SpeicherGrenze ein individuelles Heimladeprofil für Elektrofahrzeuge
          erzeugt.
        </MethodikP>
        <MethodikP>
          Das Ladeprofil basiert ausschließlich auf den vom Nutzer angegebenen
          Eingabedaten. Es werden keine durchschnittlichen Fahrprofile,
          pauschalen Verbrauchswerte oder vereinfachten Standardannahmen
          verwendet.
        </MethodikP>
        <MethodikP>
          Das Ergebnis dieser Methodik ist ein deterministisches
          15-Minuten-Ladeprofil, das zusammen mit dem Haushaltslastprofil und
          einer optionalen Wärmepumpe die Grundlage der Speicherberechnung
          bildet.
        </MethodikP>
        <MethodikMinorHeading title="Grundprinzip">
          <MethodikP>
            <strong>
              SpeicherGrenze versucht nicht, das Verhalten eines durchschnittlichen
              Haushalts vorherzusagen.
            </strong>
          </MethodikP>
          <MethodikP>
            <strong>
              SpeicherGrenze berechnet den konkreten Haushalt anhand der vom
              Nutzer angegebenen Daten.
            </strong>
          </MethodikP>
        </MethodikMinorHeading>
      </MethodikSection>

      <MethodikSection title="Warum wird das Elektroauto separat modelliert?">
        <MethodikP>
          Ein Elektrofahrzeug erhöht nicht nur den jährlichen Stromverbrauch
          eines Haushalts. Es verändert vor allem den zeitlichen Verlauf des
          Energiebedarfs.
        </MethodikP>
        <MethodikP>
          Für die Dimensionierung eines Batteriespeichers ist deshalb nicht
          allein entscheidend, wie viel Energie ein Elektrofahrzeug im Jahr
          benötigt. Ebenso wichtig ist, wann das Fahrzeug zu Hause verfügbar
          ist und in welchen Zeitfenstern es geladen werden kann.
        </MethodikP>
        <MethodikP>
          Zwei Haushalte mit identischer Jahresfahrleistung können dadurch völlig
          unterschiedliche Lastprofile aufweisen. Unterschiede entstehen
          beispielsweise durch verschiedene Fahrgewohnheiten, Ladefenster oder
          regelmäßige Lademöglichkeiten am Arbeitsplatz.
        </MethodikP>
        <MethodikP>
          SpeicherGrenze berücksichtigt das Elektrofahrzeug deshalb nicht als
          pauschalen Zusatzverbrauch. Stattdessen wird aus den vom Nutzer
          angegebenen Eingabedaten zunächst ein individuelles Heimladeprofil
          erzeugt. Erst dieses Ladeprofil wird anschließend gemeinsam mit der
          Haushaltslast und einer optionalen Wärmepumpe für die
          Speicherberechnung verwendet.
        </MethodikP>
        <MethodikFlowDiagram
          nodes={[
            { label: "Fahrzeugdaten" },
            { label: "Individuelles Heimladeprofil" },
            { label: "Haushaltslast", join: "optionale Wärmepumpe" },
            { label: "Gesamtlastprofil" },
            { label: "Speicherberechnung" },
          ]}
        />
      </MethodikSection>

      <MethodikSection title="Welche Eingabedaten werden verwendet?">
        <MethodikP>
          Die Qualität eines berechneten Ladeprofils hängt unmittelbar von den
          verfügbaren Eingabedaten ab. SpeicherGrenze verwendet deshalb
          ausschließlich Parameter, die einen nachweisbaren Einfluss auf den
          Energiebedarf oder auf den zeitlichen Verlauf der Heimladung haben.
        </MethodikP>
        <MethodikP>
          Es werden keine Informationen abgefragt, die für die Berechnung keinen
          messbaren Mehrwert liefern. Gleichzeitig werden keine Standardwerte
          oder typischen Fahrprofile angenommen, wenn diese durch konkrete
          Nutzereingaben ersetzt werden können.
        </MethodikP>
        <MethodikP>
          Die folgenden Eingabedaten bilden die Grundlage für die Berechnung des
          Heimladeprofils.
        </MethodikP>

        <MethodikMinorHeading title="Fahrzeug">
          <MethodikTable
            columns={[
              { key: "input", header: "Eingabe" },
              { key: "unit", header: "Einheit" },
              { key: "purpose", header: "Zweck" },
            ]}
            rowHeaders
            rows={[
              [
                "Jahresfahrleistung",
                "km/Jahr",
                "Bestimmt den jährlichen Energiebedarf des Fahrzeugs.",
              ],
              [
                "Stromverbrauch",
                "kWh/100 km",
                "Wandelt die Fahrleistung in einen jährlichen Strombedarf um.",
              ],
              [
                "Nutzbare Batteriekapazität",
                "kWh",
                "Bestimmt, wie viel Energie das Fahrzeug zwischen Fahrten speichern kann.",
              ],
            ]}
          />
          <MethodikKickerHeading title="Typische Fahrstrecken" />
          <MethodikTable
            columns={[
              { key: "input", header: "Eingabe" },
              { key: "unit", header: "Einheit" },
              { key: "purpose", header: "Zweck" },
            ]}
            rowHeaders
            rows={[
              [
                "Montag bis Freitag",
                "km/Tag",
                "Beschreibt das typische Fahrverhalten an Werktagen.",
              ],
              [
                "Samstag",
                "km/Tag",
                "Berücksichtigt abweichende Fahrten am Wochenende.",
              ],
              [
                "Sonntag",
                "km/Tag",
                "Berücksichtigt ruhige oder fahrfreie Tage.",
              ],
            ]}
          />
          <MethodikP>
            Die Angaben zu den typischen Fahrstrecken bestimmen{" "}
            <strong>nicht</strong> den jährlichen Energiebedarf. Dieser wird
            ausschließlich aus der angegebenen Jahresfahrleistung berechnet.
          </MethodikP>
          <MethodikP>
            Die typischen Tagesfahrstrecken beschreiben ausschließlich die
            zeitliche Verteilung der Fahrleistung innerhalb einer Woche.
            SpeicherGrenze skaliert diese Verteilung automatisch so, dass sie
            exakt zur angegebenen Jahresfahrleistung passt.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Laden zu Hause">
          <MethodikTable
            columns={[
              { key: "input", header: "Eingabe" },
              { key: "unit", header: "Einheit" },
              { key: "purpose", header: "Zweck" },
            ]}
            rowHeaders
            rows={[
              [
                "Maximale Ladeleistung",
                "kW",
                "Begrenzt die maximal mögliche Ladeenergie pro Zeiteinheit.",
              ],
              [
                "Ladefenster Montag bis Freitag",
                "Uhrzeit",
                "Definiert, wann zu Hause geladen werden kann.",
              ],
              [
                "Ladefenster Samstag",
                "Uhrzeit",
                "Berücksichtigt abweichende Verfügbarkeit am Wochenende.",
              ],
              [
                "Ladefenster Sonntag",
                "Uhrzeit",
                "Berücksichtigt individuelle Ladezeiten am Sonntag.",
              ],
            ]}
          />
          <MethodikP>
            Die Ladefenster definieren den Zeitraum, in dem das Fahrzeug zu
            Hause normalerweise zum Laden angeschlossen ist.
          </MethodikP>
          <MethodikP>
            Benötigt das Fahrzeug Energie, kann die Heimladung ausschließlich
            innerhalb dieses Zeitfensters beginnen. Außerhalb des angegebenen
            Ladefensters findet keine Heimladung statt.
          </MethodikP>
          <MethodikP>
            Dabei handelt es sich ausdrücklich nicht um eine PV-optimierte
            Ladesteuerung. SpeicherGrenze berücksichtigt bei der Erzeugung des
            Heimladeprofils weder die aktuelle PV-Erzeugung noch dynamische
            Stromtarife oder den Ladezustand des Heimspeichers.
          </MethodikP>
          <MethodikP>
            Das Ladefenster wird ausschließlich durch den Nutzer festgelegt. Wer
            sein Fahrzeug am Wochenende üblicherweise tagsüber anschließt, kann
            ein entsprechendes Ladefenster, beispielsweise 10:00 bis 16:00 Uhr,
            angeben. Wird das Fahrzeug überwiegend über Nacht geladen, sollte
            ein entsprechendes Nachtfenster, beispielsweise 17:30 bis 07:00 Uhr,
            gewählt werden.
          </MethodikP>
          <MethodikP>
            Das erzeugte Heimladeprofil bildet damit ausschließlich die vom
            Nutzer angegebene Ladeverfügbarkeit ab. Versteckte Annahmen über das
            Ladeverhalten werden nicht getroffen.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Laden am Arbeitsplatz">
          <MethodikTable
            columns={[
              { key: "input", header: "Eingabe" },
              { key: "unit", header: "Einheit" },
              { key: "purpose", header: "Zweck" },
            ]}
            rowHeaders
            rows={[
              [
                "Arbeitsplatzladung vorhanden",
                "Ja / Nein",
                "Berücksichtigt regelmäßige Lademöglichkeiten außerhalb des Hauses.",
              ],
              [
                "Geladene Energie",
                "kWh/Monat",
                "Beschreibt die durchschnittlich geladene Energiemenge.",
              ],
              [
                "Ladetage",
                "Tage/Monat",
                "Beschreibt, auf wie viele Ladevorgänge sich diese Energiemenge verteilt.",
              ],
            ]}
          />
          <MethodikP>
            Die monatliche Energiemenge allein reicht für eine realistische
            Modellierung nicht aus. 120 kWh pro Monat können beispielsweise
            durch vier größere Ladevorgänge oder durch zwanzig kleine
            Ladevorgänge entstehen. Beide Fälle führen zu einem unterschiedlichen
            Ladeverhalten zu Hause.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Warum werden keine weiteren Daten abgefragt?">
          <MethodikP>
            SpeicherGrenze beschränkt die Eingaben bewusst auf Parameter, die
            einen direkten Einfluss auf das Ladeprofil haben. Informationen wie
            Fahrzeugmodell, Hersteller oder Batterietechnologie werden für die
            Berechnung des Heimladeprofils nicht benötigt und deshalb nicht
            abgefragt.
          </MethodikP>
          <MethodikP>
            Ebenso werden keine Annahmen über Abfahrtszeiten, Rückkehrzeiten oder
            tägliche Fahrstrecken getroffen. Soweit möglich basiert die
            Berechnung ausschließlich auf den vom Nutzer bereitgestellten
            Informationen.
          </MethodikP>
        </MethodikMinorHeading>
      </MethodikSection>

      <MethodikSection title="Wie berechnet SpeicherGrenze das Ladeprofil?">
        <MethodikP>
          Das Heimladeprofil entsteht in mehreren aufeinander aufbauenden
          Berechnungsschritten. Jeder Schritt verwendet ausschließlich die zuvor
          beschriebenen Eingabedaten. Es werden keine zusätzlichen Annahmen über
          das Fahrverhalten oder über Ladegewohnheiten getroffen.
        </MethodikP>

        <MethodikMinorHeading title="Schritt 1">
          <MethodikKickerHeading title="Berechnung des jährlichen Energiebedarfs" />
          <MethodikFlowDiagram
            nodes={[
              { label: "Jahresfahrleistung", join: "Stromverbrauch" },
              { label: "jährlicher Energiebedarf" },
            ]}
          />
          <MethodikP>
            Aus der angegebenen Jahresfahrleistung und dem Stromverbrauch wird
            zunächst der jährliche Energiebedarf des Fahrzeugs berechnet.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Schritt 2">
          <MethodikKickerHeading title="Zeitliche Verteilung" />
          <MethodikFlowDiagram
            nodes={[
              { label: "Mo–Fr\nSamstag\nSonntag" },
              { label: "Verteilung über das Kalenderjahr" },
            ]}
          />
          <MethodikP>
            Anschließend wird dieser Energiebedarf entsprechend der angegebenen
            typischen Fahrstrecken auf die einzelnen Tage des Jahres verteilt.
            Die Jahresfahrleistung bleibt dabei unverändert. Die Tageswerte
            bestimmen ausschließlich die zeitliche Verteilung.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Schritt 3">
          <MethodikKickerHeading title="Arbeitsplatzladung" />
          <MethodikFlowDiagram
            nodes={[
              { label: "Fahrenergie" },
              { label: "Arbeitsplatzladung" },
              { label: "verbleibender Energiebedarf" },
            ]}
          />
          <MethodikP>
            Falls regelmäßig am Arbeitsplatz geladen wird, berücksichtigt
            SpeicherGrenze diese Energiemenge als zusätzliche Energiequelle
            außerhalb des Hauses. Dadurch reduziert sich der spätere
            Heimladebedarf entsprechend der tatsächlichen Ladevorgänge.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Schritt 4">
          <MethodikKickerHeading title="Fahrzeugbatterie" />
          <MethodikFlowDiagram
            nodes={[
              { label: "Fahrt" },
              { label: "Fahrzeugbatterie" },
              { label: "Heimladung" },
            ]}
          />
          <MethodikP>
            Die Fahrzeugbatterie dient während der gesamten Simulation als
            Energiespeicher zwischen Fahrten und Ladevorgängen. Dadurch kann
            Energie über mehrere Tage gespeichert und später wieder genutzt
            werden. Dieses Verhalten entspricht dem realen Einsatz eines
            Elektrofahrzeugs wesentlich besser als eine rein tägliche
            Bilanzierung.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Schritt 5">
          <MethodikKickerHeading title="Erzeugung des Heimladeprofils" />
          <MethodikFlowDiagram
            nodes={[
              {
                label: "Ladefenster",
                join: ["Ladeleistung", "Fahrzeugbatterie"],
              },
              { label: "15-Minuten-Heimladeprofil" },
            ]}
          />
          <MethodikP>
            Innerhalb der angegebenen Ladefenster wird ein deterministisches
            15-Minuten-Heimladeprofil erzeugt. Außerhalb dieser Zeiträume findet
            keine Heimladung statt.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Schritt 6">
          <MethodikKickerHeading title="Übergabe an die Speicherberechnung" />
          <MethodikFlowDiagram
            nodes={[
              {
                label: "Haushalt",
                join: ["Wärmepumpe", "Elektroauto"],
              },
              { label: "Gesamtlastprofil" },
              { label: "SpeicherGrenze" },
            ]}
          />
          <MethodikP>
            Das erzeugte Heimladeprofil wird anschließend gemeinsam mit dem
            Haushaltslastprofil und einer optionalen Wärmepumpe zu einem
            gemeinsamen Lastprofil zusammengeführt. Erst dieses Gesamtlastprofil
            bildet die Grundlage der eigentlichen Speicherberechnung.
          </MethodikP>
        </MethodikMinorHeading>
      </MethodikSection>

      <MethodikSection title="Rechenbeispiel">
        <MethodikP>
          Die folgenden Eingabedaten dienen ausschließlich zur Veranschaulichung
          der Berechnung. Für jeden Haushalt erzeugt SpeicherGrenze ein eigenes
          Ladeprofil auf Grundlage der tatsächlich eingegebenen Nutzerdaten.
        </MethodikP>

        <MethodikSubSection title="Eingabedaten">
          <MethodikP>
            Für dieses Beispiel werden folgende Fahrzeug- und Ladedaten
            verwendet.
          </MethodikP>
          <MethodikKickerHeading title="Fahrzeug" />
          <MethodikTable
            columns={[
              { key: "parameter", header: "Parameter" },
              { key: "value", header: "Wert" },
            ]}
            rowHeaders
            rows={[
              ["Jahresfahrleistung", "18.000 km"],
              ["Stromverbrauch", "17,5 kWh / 100 km"],
              ["Nutzbare Batteriekapazität", "60 kWh"],
            ]}
          />
          <MethodikKickerHeading title="Typische Fahrstrecken" />
          <MethodikTable
            columns={[
              { key: "day", header: "Wochentag" },
              { key: "distance", header: "Fahrstrecke" },
            ]}
            rowHeaders
            rows={[
              ["Montag–Freitag", "55 km"],
              ["Samstag", "25 km"],
              ["Sonntag", "0 km"],
            ]}
          />
          <MethodikKickerHeading title="Heimladung" />
          <MethodikTable
            columns={[
              { key: "parameter", header: "Parameter" },
              { key: "value", header: "Wert" },
            ]}
            rowHeaders
            rows={[
              ["Maximale Ladeleistung", "11 kW"],
              ["Ladefenster Montag–Freitag", "17:30 – 07:00"],
              ["Ladefenster Samstag", "10:00 – 16:00"],
              ["Ladefenster Sonntag", "10:00 – 16:00"],
            ]}
          />
          <MethodikKickerHeading title="Arbeitsplatzladung" />
          <MethodikTable
            columns={[
              { key: "parameter", header: "Parameter" },
              { key: "value", header: "Wert" },
            ]}
            rowHeaders
            rows={[
              ["Arbeitsplatzladung", "Ja"],
              ["Geladene Energie", "120 kWh / Monat"],
              ["Ladetage", "4 pro Monat"],
            ]}
          />
          <MethodikKickerHeading title="Ergebnis der Berechnung" />
          <MethodikTable
            columns={[
              { key: "result", header: "Ergebnis" },
              { key: "value", header: "Wert" },
            ]}
            rowHeaders
            rows={[
              [
                "Jährlicher Fahrenergiebedarf",
                <strong key="annual-drive">3.150 kWh</strong>,
              ],
              [
                "Heimladung",
                <strong key="home-charge">
                  {formatMethodikKwhDe(example.yearEnergyKwh, 1)} kWh
                </strong>,
              ],
              [
                "Arbeitsplatzladung",
                <strong key="workplace">531,2 kWh</strong>,
              ],
              [
                "Nicht nutzbare Arbeitsplatzladung",
                <strong key="workplace-rejected">908,8 kWh</strong>,
              ],
              ["Zeitauflösung", <strong key="resolution">15 Minuten</strong>],
              [
                "Anzahl der Zeitschritte",
                <strong key="steps">
                  {new Intl.NumberFormat("de-DE").format(example.rowCount)}
                </strong>,
              ],
            ]}
          />
        </MethodikSubSection>

        <MethodikSubSection title="Berechnetes Ladeprofil (CSV)">
          <MethodikP>
            Das vollständige Ladeprofil dieses Rechenbeispiels kann als
            CSV-Datei heruntergeladen werden.
          </MethodikP>
          <MethodikDownloadBox
            title="Vollständiges Referenzprofil"
            description="Diese Ergebnisse werden vollständig aus den oben gezeigten Eingabedaten berechnet. Das daraus erzeugte Heimladeprofil bildet die Grundlage für alle weiteren Berechnungen innerhalb von SpeicherGrenze."
            href={EV_HOME_CHARGING_EXAMPLE_DOWNLOAD_PATH}
            fileLabel={EV_HOME_CHARGING_EXAMPLE_FILENAME}
          />
          <MethodikKickerHeading title="Auszug aus der CSV-Datei" />
          <MethodikCsvPreview
            headers={["Datum", "Uhrzeit", "Heimladung"]}
            rows={previewRows(example)}
          />
          <MethodikInfoBox>
            <p>
              Das vollständige Profil besteht aus 35.040 Zeitschritten und
              deckt das gesamte Kalenderjahr ab. Die CSV-Datei dient
              ausschließlich zur Veranschaulichung der Methodik.
            </p>
            <p>
              <strong>
                Das hier veröffentlichte CSV wurde direkt mit der produktiven
                Berechnungslogik von SpeicherGrenze erzeugt. Es handelt sich
                nicht um eine Beispielsimulation oder um manuell erzeugte
                Testdaten.
              </strong>
            </p>
          </MethodikInfoBox>
        </MethodikSubSection>

        <MethodikSubSection title="Visualisierung">
          <MethodikP>
            Die folgende Abbildung zeigt das aus den Eingabedaten erzeugte
            Heimladeprofil.
          </MethodikP>
          <MethodikLineChart
            data={example.week.points}
            seriesLabel="Heimladung"
            xLabel="Datum / Uhrzeit"
            yLabel="Heimladung [kWh je 15 min]"
            caption={`Dargestellt sind die 15-Minuten-Werte vom ${chartStart}, ${example.week.startTime} Uhr, bis ${chartEnd}, ${example.week.endTime} Uhr. Die Werte stammen unverändert aus dem Referenzprofil.`}
          />
        </MethodikSubSection>

        <MethodikSubSection title="Interpretation">
          <MethodikP>
            In diesem Beispiel beträgt der jährliche Fahrenergiebedarf{" "}
            <strong>3.150 kWh</strong>.
          </MethodikP>
          <MethodikP>
            Davon werden <strong>531,2 kWh</strong> regelmäßig am Arbeitsplatz
            geladen.
          </MethodikP>
          <MethodikP>
            Für die Heimladung verbleiben <strong>2.618,8 kWh</strong>, die
            SpeicherGrenze entsprechend der angegebenen Ladefenster auf das
            gesamte Kalenderjahr verteilt.
          </MethodikP>
          <MethodikP>
            Im gewählten Beispiel steht das Fahrzeug an Werktagen erst ab{" "}
            <strong>17:30 Uhr</strong> für die Heimladung zur Verfügung. Deshalb
            entstehen die meisten Ladevorgänge in den Abend- und Nachtstunden.
          </MethodikP>
          <MethodikP>
            An Samstagen und Sonntagen gilt in diesem Beispiel das Ladefenster{" "}
            <strong>10:00–16:00</strong>. Dieses Tagesfenster ist ausdrücklich
            angegeben. Ob tatsächlich geladen wird, hängt ausschließlich vom
            Energiezustand der Fahrzeugbatterie ab. Verfügbarkeit bedeutet nicht
            automatisch, dass geladen werden muss.
          </MethodikP>
          <MethodikP>
            Im vorliegenden Beispiel können <strong>908,8 kWh</strong> der
            theoretisch verfügbaren Arbeitsplatzladung nicht genutzt werden.
            Ursache ist die begrenzte Speicherkapazität der Fahrzeugbatterie.
            SpeicherGrenze berücksichtigt deshalb ausschließlich die
            Energiemenge, die physikalisch tatsächlich aufgenommen werden kann.
          </MethodikP>
          <MethodikP>
            Das erzeugte Heimladeprofil wird anschließend gemeinsam mit der
            Haushaltslast und einer optionalen Wärmepumpe zum Gesamtlastprofil
            zusammengeführt und bildet die Grundlage der Speicherberechnung.
          </MethodikP>
        </MethodikSubSection>
      </MethodikSection>

      <MethodikSection title="Grenzen des Modells">
        <MethodikP>
          Das EV-Modell von SpeicherGrenze bildet den Energiebedarf und die
          Heimladung eines Elektrofahrzeugs auf Basis der angegebenen Nutzerdaten
          ab. Es ist für die Dimensionierung eines Heimspeichers ausgelegt. Eine
          vollständige Fahrzeugsimulation ist nicht Ziel des Modells.
        </MethodikP>
        <MethodikP>
          Die folgenden Grenzen sind bei der Interpretation der Ergebnisse zu
          berücksichtigen.
        </MethodikP>

        <MethodikMinorHeading title="Keine exakten Abfahrts- und Ankunftszeiten">
          <MethodikP>
            SpeicherGrenze fragt keine einzelnen Fahrten oder festen
            Abfahrtszeiten ab. Die typischen Fahrstrecken für Montag bis
            Freitag, Samstag und Sonntag beschreiben die Verteilung der
            Fahrleistung innerhalb des Jahres.
          </MethodikP>
          <MethodikP>
            Die angegebenen Ladefenster legen fest, wann das Fahrzeug für die
            Heimladung verfügbar ist. Sie ersetzen keinen detaillierten
            Fahrtenkalender.
          </MethodikP>
          <MethodikP>
            Das Modell eignet sich damit für die energetische Speicherberechnung,
            nicht für die minutengenaue Rekonstruktion einzelner
            Fahrzeugbewegungen.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Arbeitsplatzladung wird regelmäßig verteilt">
          <MethodikP>
            Bei vorhandener Arbeitsplatzladung werden die angegebene monatliche
            Energiemenge und die Anzahl der Ladetage berücksichtigt.
          </MethodikP>
          <MethodikP>
            SpeicherGrenze kennt jedoch nicht die tatsächlichen Kalendertage, an
            denen das Fahrzeug am Arbeitsplatz geladen wird. Die Ladevorgänge
            werden deshalb innerhalb der möglichen Werktage eines Monats nach
            einem festen, reproduzierbaren Verfahren verteilt.
          </MethodikP>
          <MethodikP>
            Dabei kann nur so viel Energie aufgenommen werden, wie die
            Fahrzeugbatterie zum jeweiligen Zeitpunkt noch aufnehmen kann. Nicht
            aufnehmbare Energie wird nicht künstlich auf andere Tage
            verschoben.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Konstanter Fahrzeugverbrauch">
          <MethodikP>
            Der eingegebene Stromverbrauch in kWh/100 km wird für das gesamte
            Berechnungsjahr verwendet.
          </MethodikP>
          <MethodikP>
            Einflüsse wie Außentemperatur, Geschwindigkeit, Fahrstil, Heizung,
            Klimatisierung oder unterschiedliche Streckenprofile werden nicht
            separat modelliert.
          </MethodikP>
          <MethodikP>
            Werden diese Effekte bereits durch einen realistischen
            Jahresverbrauch des Fahrzeugs berücksichtigt, fließen sie indirekt
            in die Berechnung ein.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Keine detaillierte Ladecharakteristik des Fahrzeugs">
          <MethodikP>
            Die maximale Ladeleistung begrenzt die Heimladung. Eine
            fahrzeugspezifische Reduzierung der Ladeleistung bei hohem
            Batterieladestand wird nicht modelliert.
          </MethodikP>
          <MethodikP>
            Ebenso werden Batterietemperatur, Zellchemie, Alterung und
            fahrzeugspezifische Ladeelektronik nicht separat berücksichtigt.
          </MethodikP>
          <MethodikP>
            Für die Speicherberechnung wird die nutzbare Batteriekapazität als
            begrenzter Energiespeicher behandelt.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Keine separate Modellierung von Ladeverlusten">
          <MethodikP>
            Der angegebene Verbrauch in kWh/100 km wird in der aktuellen
            Methodik als Energiebedarf der Fahrzeugladung verwendet.
          </MethodikP>
          <MethodikP>
            Zusätzliche Verluste der Wallbox, des Onboard-Laders oder der
            Fahrzeugbatterie werden nicht als eigener Verlustfaktor
            aufgeschlagen. Sollen diese Verluste berücksichtigt werden, sollte
            der eingegebene Verbrauch möglichst dem tatsächlich gemessenen
            Strombezug für das Fahrzeug entsprechen.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Keine intelligente Ladesteuerung">
          <MethodikP>
            Version 1.0 modelliert eine normale, nicht PV-optimierte Heimladung
            innerhalb der vom Nutzer angegebenen Ladefenster.
          </MethodikP>
          <MethodikP>Nicht Bestandteil dieser Methodik sind:</MethodikP>
          <MethodikList
            items={[
              "PV-Überschussladen",
              "dynamische Stromtarife",
              "tarifabhängige Ladeverschiebung",
              "HEMS-gesteuertes Laden",
              "Vehicle-to-Home oder bidirektionales Laden",
              "gezielte Optimierung der Fahrzeugladung anhand des Ladezustands des Heimspeichers",
            ]}
          />
          <MethodikP>
            Diese Funktionen würden das Ladeverhalten aktiv verändern und
            benötigen deshalb eine eigene Methodik.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Ein Elektrofahrzeug pro Berechnung">
          <MethodikP>
            Die aktuelle Methodik bildet ein Elektrofahrzeug ab. Mehrere
            Fahrzeuge mit unterschiedlichen Fahrprofilen, Batteriekapazitäten
            und Ladefenstern werden in Version 1.0 nicht als getrennte Fahrzeuge
            simuliert.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikInfoBox title="Einordnung">
          <p>
            Diese Grenzen bedeuten nicht, dass die genannten Effekte grundsätzlich
            unwichtig sind. Sie definieren den Anwendungsbereich der aktuellen
            Methodik.
          </p>
          <p>
            SpeicherGrenze verwendet das EV-Modell, um den für die
            Speicherberechnung relevanten{" "}
            <strong>zeitlichen Heimladebedarf</strong> aus den tatsächlich
            verfügbaren Kundendaten abzuleiten. Wo keine Kundendaten vorliegen,
            werden keine detaillierten Fahrten oder Ladeereignisse erfunden.
          </p>
        </MethodikInfoBox>
      </MethodikSection>

      <MethodikSection title="Validierung">
        <MethodikP>
          Die Berechnung des EV-Ladeprofils wird auf mehreren Ebenen geprüft.
          Ziel der Validierung ist sicherzustellen, dass das Modell
          reproduzierbare Ergebnisse liefert und die Energieflüsse innerhalb der
          Simulation nachvollziehbar bleiben.
        </MethodikP>

        <MethodikMinorHeading title="Deterministische Berechnung">
          <MethodikP>
            Bei identischen Eingabedaten erzeugt SpeicherGrenze immer dasselbe
            Ladeprofil.
          </MethodikP>
          <MethodikP>
            Es werden keine zufälligen Fahrten, Ladezeiten oder zusätzlichen
            Verbrauchswerte erzeugt. Dadurch kann ein Ergebnis jederzeit mit
            denselben Eingaben erneut berechnet und überprüft werden.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Energiebilanz">
          <MethodikP>
            Für jedes berechnete Jahr wird kontrolliert, ob die Energieströme
            innerhalb des Fahrzeugmodells zusammenpassen.
          </MethodikP>
          <MethodikP>
            Dabei werden insbesondere folgende Größen getrennt erfasst:
          </MethodikP>
          <MethodikList
            items={[
              "Fahrenergiebedarf",
              "tatsächlich gedeckter Fahrenergiebedarf",
              "nicht gedeckter Fahrenergiebedarf",
              "deklarierte Arbeitsplatzladung",
              "tatsächlich aufgenommene Arbeitsplatzladung",
              "nicht aufnehmbare Arbeitsplatzladung",
              "Heimladung",
              "Energieinhalt der Fahrzeugbatterie zu Beginn und am Ende des Berechnungszeitraums",
            ]}
          />
          <MethodikP>
            So kann überprüft werden, ob Energie innerhalb der Simulation
            verloren geht, doppelt berücksichtigt wird oder an einer Stelle
            auftaucht, an der sie physikalisch nicht vorhanden sein kann.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Begrenzung durch die Fahrzeugbatterie">
          <MethodikP>
            Der Energieinhalt der Fahrzeugbatterie darf während der gesamten
            Berechnung weder unter null fallen noch die angegebene nutzbare
            Batteriekapazität überschreiten.
          </MethodikP>
          <MethodikP>
            Auch externe Ladevorgänge werden nur bis zur verfügbaren freien
            Batteriekapazität berücksichtigt.
          </MethodikP>
          <MethodikP>
            Das Rechenbeispiel dieser Methodik zeigt diesen Fall unmittelbar: Von
            den jährlich angebotenen <strong>1.440 kWh</strong> Arbeitsplatzladung
            können <strong>531,2 kWh</strong> tatsächlich aufgenommen werden.{" "}
            <strong>908,8 kWh</strong> bleiben ungenutzt, weil das Fahrzeug zu
            den entsprechenden Zeitpunkten keine zusätzliche Energie aufnehmen
            kann.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Prüfung der Ladefenster">
          <MethodikP>
            Heimladung darf ausschließlich innerhalb der vom Nutzer angegebenen
            Zeitfenster stattfinden.
          </MethodikP>
          <MethodikP>
            Jedes Ladefenster hat eine ausdrückliche Anfangs- und Endzeit.
            Identische Anfangs- und Endzeiten sind ungültig und bedeuten nicht
            eine Verfügbarkeit über 24 Stunden.
          </MethodikP>
          <MethodikP>
            Für jedes 15-Minuten-Intervall wird geprüft, ob das Fahrzeug zu
            diesem Zeitpunkt für die Heimladung verfügbar ist. Außerhalb dieser
            Zeiträume bleibt die EV-Heimlast bei null.
          </MethodikP>
          <MethodikP>
            Die maximale Ladeenergie pro Intervall wird zusätzlich durch die
            angegebene Ladeleistung begrenzt.
          </MethodikP>
          <MethodikP>
            Bei einer Ladeleistung von 11 kW können beispielsweise innerhalb
            eines 15-Minuten-Intervalls maximal <strong>2,75 kWh</strong> geladen
            werden.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Jährliche Fahrleistung">
          <MethodikP>
            Die typische Fahrstrecke für Montag bis Freitag, Samstag und Sonntag
            dient ausschließlich zur zeitlichen Verteilung der Fahrleistung.
          </MethodikP>
          <MethodikP>
            Die daraus entstehende Tagesstruktur wird für jedes Kalenderjahr so
            angepasst, dass die vom Nutzer angegebene Jahresfahrleistung
            vollständig erhalten bleibt.
          </MethodikP>
          <MethodikP>
            Im Referenzbeispiel ergeben <strong>18.000 km/Jahr</strong> bei{" "}
            <strong>17,5 kWh/100 km</strong> deshalb unabhängig von der
            Verteilung exakt <strong>3.150 kWh Fahrenergiebedarf</strong>.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Kalenderabhängige Berechnung">
          <MethodikP>
            Das Ladeprofil wird für das jeweilige Kalenderjahr neu erzeugt.
            Dadurch werden die tatsächlichen Wochentage des Jahres
            berücksichtigt.
          </MethodikP>
          <MethodikP>
            Ein Montag bleibt ein Werktag, ein Samstag wird mit dem angegebenen
            Samstagsprofil berechnet und ein Sonntag mit dem Sonntagsprofil.
          </MethodikP>
          <MethodikP>
            Für die Speicherberechnung verwendet SpeicherGrenze damit kein
            abstraktes Standardjahr mit einer immer gleichen Wochenfolge.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Stabile Jahresgrenze">
          <MethodikP>
            Der Energiezustand der Fahrzeugbatterie darf nicht davon abhängen,
            mit welchem willkürlichen Ladezustand die Berechnung am 1. Januar
            gestartet wird.
          </MethodikP>
          <MethodikP>
            SpeicherGrenze behandelt das Fahrzeug deshalb als wiederkehrendes
            Jahressystem. Die Berechnung wird so lange auf das gleiche Jahr
            angewendet, bis sich der Batteriezustand an der Jahresgrenze
            stabilisiert hat.
          </MethodikP>
          <MethodikP>
            Erst dieser stabile Jahreszustand wird für das endgültige
            Ladeprofil verwendet.
          </MethodikP>
          <MethodikP>
            Dadurch wird verhindert, dass ein zufällig gewählter Startwert das
            Ergebnis der Speicherberechnung beeinflusst.
          </MethodikP>
        </MethodikMinorHeading>

        <MethodikMinorHeading title="Referenzprofil">
          <MethodikP>
            Das in Kapitel 5 veröffentlichte CSV dient gleichzeitig als
            reproduzierbares Referenzbeispiel der Methodik.
          </MethodikP>
          <MethodikP>
            Die Datei wurde direkt mit der produktiven Berechnungslogik von
            SpeicherGrenze erzeugt. Bei unveränderter Methodik und identischen
            Eingabedaten muss das gleiche Ladeprofil erneut entstehen.
          </MethodikP>
          <MethodikP>
            Änderungen an der Berechnungslogik können dadurch gegen einen
            bekannten Referenzfall geprüft werden.
          </MethodikP>
        </MethodikMinorHeading>
      </MethodikSection>

      <MethodikSection title="Transparenz">
        <MethodikP>
          SpeicherGrenze veröffentlicht die verwendeten Berechnungsmethoden
          bewusst offen.
        </MethodikP>
        <MethodikP>
          Ziel ist es, Ergebnisse nachvollziehbar und überprüfbar zu machen.
          Fachbetriebe, Planer und interessierte Nutzer sollen verstehen können,
          welche Eingabedaten verwendet werden, welche Annahmen getroffen werden
          und wie daraus die Ergebnisse entstehen.
        </MethodikP>
        <MethodikP>
          Jede veröffentlichte Methodik wird versioniert. Änderungen am
          Berechnungsverfahren werden dokumentiert und ältere Versionen bleiben
          archiviert.
        </MethodikP>
      </MethodikSection>
    </MethodikArticle>
  );
}
