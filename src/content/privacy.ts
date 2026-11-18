/**
 * Шаблон политики под Закон РК «О персональных данных и их защите» от 21.05.2013 № 94-V.
 * Перед запуском: попросите юриста проверить текст и добавьте реквизиты (ИП/ТОО, БИН/ИИН).
 */
export type PolicySection = { title: string; body: string[] };

export const privacy: Record<string, { updated: string; intro: string; sections: PolicySection[] }> = {
  ru: {
    updated: "Редакция от 4 ноября 2026 года",
    intro:
      "Эта политика объясняет, какие персональные данные собирает визовое агентство AlemWay Visa (г. Алматы, далее — «мы», «Оператор») через этот сайт, зачем, как мы их храним и защищаем. Политика составлена в соответствии с Законом Республики Казахстан «О персональных данных и их защите» от 21 мая 2013 года № 94-V.",
    sections: [
      {
        title: "1. Какие данные мы собираем",
        body: [
          "Через форму заявки: имя, номер телефона, выбранная услуга, комментарий (если вы его оставили).",
          "Технические данные: страница, с которой отправлена заявка, язык сайта, UTM-метки рекламной ссылки. Эти данные не позволяют установить вашу личность.",
          "Документы для оформления виз и разрешений (паспорт, фото и т. п.) мы получаем только при отдельной переписке в WhatsApp или в офисе — через сайт они не собираются.",
        ],
      },
      {
        title: "2. Зачем мы обрабатываем данные",
        body: [
          "Чтобы связаться с вами по заявке, проконсультировать и оказать выбранную услугу.",
          "Чтобы вести учёт заявок и улучшать работу сайта (обезличенная статистика).",
          "Мы не используем ваши данные для рассылок без вашего отдельного согласия и не продаём их третьим лицам.",
        ],
      },
      {
        title: "3. Согласие",
        body: [
          "Отправляя форму, вы отмечаете галочку и тем самым даёте согласие на сбор и обработку персональных данных в целях, указанных выше (ст. 7–8 Закона).",
          "Вы можете отозвать согласие в любой момент, написав нам на email или в WhatsApp, — кроме случаев, когда это противоречит законодательству РК или неисполненному договору.",
        ],
      },
      {
        title: "4. Где и сколько хранятся данные",
        body: [
          "Заявки хранятся в защищённой системе управления контентом (Sanity) и дублируются в закрытый рабочий чат сотрудников в Telegram. Доступ есть только у сотрудников, которые работают с заявками.",
          "Данные хранятся столько, сколько нужно для оказания услуги и учёта, но не дольше 3 лет с момента последнего обращения, после чего удаляются.",
          "Сервисы хранения могут располагаться за пределами Казахстана. Отправляя заявку, вы соглашаетесь на такую трансграничную передачу (ст. 16 Закона). Мы выбираем сервисы, которые обеспечивают защиту данных.",
        ],
      },
      {
        title: "5. Как мы защищаем данные",
        body: [
          "Передача данных идёт по защищённому протоколу HTTPS.",
          "Ключи доступа хранятся только на сервере, доступ к заявкам — по личным учётным записям сотрудников.",
          "Форма защищена от автоматических спам-отправок.",
        ],
      },
      {
        title: "6. Аналитика и cookie",
        body: [
          "Мы используем Vercel Web Analytics — он считает посещения без cookie и без сбора личных данных.",
          "Если подключена Яндекс Метрика, она использует cookie для обезличенной статистики посещений. Вы можете запретить cookie в настройках браузера.",
        ],
      },
      {
        title: "7. Ваши права",
        body: [
          "Вы вправе знать, есть ли у нас ваши данные, получить их копию, потребовать исправить, заблокировать или удалить их, а также отозвать согласие (ст. 24 Закона).",
          "Для этого напишите нам — ответим в течение 10 рабочих дней.",
        ],
      },
      {
        title: "8. Контакты Оператора",
        body: ["AlemWay Visa, г. Алматы, Республика Казахстан.", "Email: alemway.kz@gmail.com", "Телефон / WhatsApp: +7 708 070 18 77"],
      },
    ],
  },
  kk: {
    updated: "2026 жылғы 4 қарашадағы редакция",
    intro:
      "Бұл саясат AlemWay Visa визалық агенттігі (Алматы қ., бұдан әрі — «біз», «Оператор») осы сайт арқылы қандай дербес деректерді жинайтынын, не үшін жинайтынын, оларды қалай сақтайтынын және қорғайтынын түсіндіреді. Саясат Қазақстан Республикасының 2013 жылғы 21 мамырдағы № 94-V «Дербес деректер және оларды қорғау туралы» Заңына сәйкес жасалған.",
    sections: [
      {
        title: "1. Қандай деректер жинаймыз",
        body: [
          "Өтінім формасы арқылы: аты, телефон нөмірі, таңдалған қызмет, пікір (қалдырсаңыз).",
          "Техникалық деректер: өтінім жіберілген бет, сайт тілі, жарнамалық сілтеменің UTM-белгілері. Бұл деректер сіздің жеке басыңызды анықтауға мүмкіндік бермейді.",
          "Виза мен рұқсат рәсімдеуге арналған құжаттарды (паспорт, фото және т.б.) тек WhatsApp-тағы жеке хат алмасу кезінде немесе кеңседе аламыз — сайт арқылы олар жиналмайды.",
        ],
      },
      {
        title: "2. Деректерді не үшін өңдейміз",
        body: [
          "Өтінім бойынша сізбен байланысу, кеңес беру және таңдалған қызметті көрсету үшін.",
          "Өтінімдерді есепке алу және сайт жұмысын жақсарту үшін (иесіздендірілген статистика).",
          "Сіздің жеке келісіміңізсіз деректеріңізді таратылымдарға пайдаланбаймыз және үшінші тұлғаларға сатпаймыз.",
        ],
      },
      {
        title: "3. Келісім",
        body: [
          "Форманы жіберу кезінде белгі қоя отырып, жоғарыда көрсетілген мақсаттарда дербес деректерді жинауға және өңдеуге келісім бересіз (Заңның 7–8-баптары).",
          "Келісімді кез келген уақытта email немесе WhatsApp арқылы жазып, кері қайтарып ала аласыз — ҚР заңнамасына немесе орындалмаған шартқа қайшы келетін жағдайларды қоспағанда.",
        ],
      },
      {
        title: "4. Деректер қайда және қанша сақталады",
        body: [
          "Өтінімдер қорғалған контент басқару жүйесінде (Sanity) сақталады және қызметкерлердің жабық Telegram жұмыс чатына көшіріледі. Оларға тек өтінімдермен жұмыс істейтін қызметкерлер қол жеткізе алады.",
          "Деректер қызмет көрсету мен есепке алуға қажетті мерзім ішінде, бірақ соңғы өтініштен кейін 3 жылдан аспайтын мерзімде сақталады, содан кейін жойылады.",
          "Сақтау қызметтері Қазақстаннан тыс жерде орналасуы мүмкін. Өтінім жібере отырып, мұндай трансшекаралық беруге келісесіз (Заңның 16-бабы).",
        ],
      },
      {
        title: "5. Деректерді қалай қорғаймыз",
        body: [
          "Деректер қорғалған HTTPS хаттамасы арқылы беріледі.",
          "Қол жеткізу кілттері тек серверде сақталады, өтінімдерге қызметкерлердің жеке есептік жазбалары арқылы ғана кіруге болады.",
          "Форма автоматты спам жіберулерден қорғалған.",
        ],
      },
      {
        title: "6. Аналитика және cookie",
        body: [
          "Vercel Web Analytics қолданамыз — ол cookie-сіз және жеке деректерді жинамай келушілерді санайды.",
          "Яндекс Метрика қосылған болса, ол иесіздендірілген статистика үшін cookie қолданады. Cookie-ді браузер баптауларында тыйым салуға болады.",
        ],
      },
      {
        title: "7. Сіздің құқықтарыңыз",
        body: [
          "Сізде деректеріңіздің бізде бар-жоғын білуге, көшірмесін алуға, оларды түзетуді, бұғаттауды немесе жоюды талап етуге, сондай-ақ келісімді кері қайтарып алуға құқығыңыз бар (Заңның 24-бабы).",
          "Ол үшін бізге жазыңыз — 10 жұмыс күні ішінде жауап береміз.",
        ],
      },
      {
        title: "8. Оператордың байланыс деректері",
        body: ["AlemWay Visa, Алматы қ., Қазақстан Республикасы.", "Email: alemway.kz@gmail.com", "Телефон / WhatsApp: +7 708 070 18 77"],
      },
    ],
  },
  de: {
    updated: "Fassung vom 4. November 2026",
    intro:
      "Diese Erklärung beschreibt, welche personenbezogenen Daten die Visaagentur AlemWay Visa (Almaty, im Folgenden „wir“, „Betreiber“) über diese Website erhebt, wozu, wie wir sie speichern und schützen. Sie wurde gemäß dem Gesetz der Republik Kasachstan „Über personenbezogene Daten und deren Schutz“ vom 21. Mai 2013 Nr. 94-V erstellt.",
    sections: [
      {
        title: "1. Welche Daten wir erheben",
        body: [
          "Über das Anfrageformular: Name, Telefonnummer, gewählte Leistung, Kommentar (falls angegeben).",
          "Technische Daten: Seite, von der die Anfrage gesendet wurde, Sprache der Website, UTM-Parameter des Werbelinks. Diese Daten lassen keine Rückschlüsse auf Ihre Person zu.",
          "Unterlagen für Visa und Genehmigungen (Pass, Foto usw.) erhalten wir nur im separaten Austausch über WhatsApp oder im Büro — über die Website werden sie nicht erhoben.",
        ],
      },
      {
        title: "2. Wozu wir die Daten verarbeiten",
        body: [
          "Um Sie zu Ihrer Anfrage zu kontaktieren, zu beraten und die gewählte Leistung zu erbringen.",
          "Um Anfragen zu erfassen und die Website zu verbessern (anonymisierte Statistik).",
          "Wir nutzen Ihre Daten ohne gesonderte Einwilligung nicht für Newsletter und verkaufen sie nicht an Dritte.",
        ],
      },
      {
        title: "3. Einwilligung",
        body: [
          "Mit dem Setzen des Häkchens und dem Absenden des Formulars willigen Sie in die Erhebung und Verarbeitung Ihrer personenbezogenen Daten zu den oben genannten Zwecken ein (Art. 7–8 des Gesetzes).",
          "Sie können die Einwilligung jederzeit per E-Mail oder WhatsApp widerrufen — außer wenn dies dem Recht der Republik Kasachstan oder einem noch nicht erfüllten Vertrag widerspricht.",
        ],
      },
      {
        title: "4. Wo und wie lange die Daten gespeichert werden",
        body: [
          "Anfragen werden in einem geschützten Content-Management-System (Sanity) gespeichert und in einen geschlossenen Arbeitschat der Mitarbeiter in Telegram übertragen. Zugriff haben nur Mitarbeiter, die mit Anfragen arbeiten.",
          "Die Daten werden so lange gespeichert, wie es für die Leistung und die Buchführung nötig ist, höchstens jedoch 3 Jahre ab dem letzten Kontakt, danach werden sie gelöscht.",
          "Die Speicherdienste können sich außerhalb Kasachstans befinden. Mit dem Absenden der Anfrage stimmen Sie dieser grenzüberschreitenden Übermittlung zu (Art. 16 des Gesetzes). Wir wählen Dienste, die den Schutz der Daten gewährleisten.",
        ],
      },
      {
        title: "5. Wie wir die Daten schützen",
        body: [
          "Die Übertragung erfolgt über das geschützte Protokoll HTTPS.",
          "Zugangsschlüssel liegen nur auf dem Server, der Zugriff auf Anfragen erfolgt über persönliche Konten der Mitarbeiter.",
          "Das Formular ist vor automatischem Spam geschützt.",
        ],
      },
      {
        title: "6. Analyse und Cookies",
        body: [
          "Wir nutzen Vercel Web Analytics — es zählt Besuche ohne Cookies und ohne personenbezogene Daten.",
          "Ist Yandex Metrica aktiviert, verwendet es Cookies für anonymisierte Besuchsstatistiken. Sie können Cookies in den Browsereinstellungen blockieren.",
        ],
      },
      {
        title: "7. Ihre Rechte",
        body: [
          "Sie haben das Recht zu erfahren, ob wir Daten über Sie haben, eine Kopie zu erhalten, deren Berichtigung, Sperrung oder Löschung zu verlangen und Ihre Einwilligung zu widerrufen (Art. 24 des Gesetzes).",
          "Schreiben Sie uns dazu — wir antworten innerhalb von 10 Werktagen.",
        ],
      },
      {
        title: "8. Kontakt des Betreibers",
        body: ["AlemWay Visa, Almaty, Republik Kasachstan.", "E-Mail: alemway.kz@gmail.com", "Telefon / WhatsApp: +7 708 070 18 77"],
      },
    ],
  },
};
