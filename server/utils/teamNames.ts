import { decodeEntities } from './text'

// Названия команд по-русски. Ключ — номер команды в API-Football (teams.home.id в ответе), в комментарии —
// её название там. Команды нет в списке — показываем название из API как есть, латиницей
const TEAM_NAMES: Record<number, string> = {
  192: 'Кёльн', // 1. FC Köln
  167: 'Хоффенхайм', // 1899 Hoffenheim
  2140: '2 де Майо', // 2 de Mayo
  406: 'АГФ Орхус', // Aarhus
  2951: 'Абха', // Abha
  489: 'Милан', // AC Milan
  238: 'Академико Визеу', // Academico Viseu
  198: 'АДО Ден Хааг', // ADO Den Haag
  575: 'АЕК', // AEK Athens FC
  194: 'Аякс', // Ajax
  1085: 'Ахмат', // Akhmat
  6786: 'Акрон', // Akron
  26738: 'Аль-Дирия', // Al Diriyah
  2928: 'Аль-Халидж', // Al Khaleej Saihat
  10509: 'Аль-Холуд', // Al Kholood
  10511: 'Аль-Рияд', // Al Riyadh
  2940: 'Аль-Шабаб', // Al Shabab
  2936: 'Аль-Таавун', // Al Taawon
  2929: 'Аль-Ахли', // Al-Ahli Jeddah
  2934: 'Аль-Иттифак', // Al-Ettifaq
  2930: 'Аль-Фейсали', // Al-Faisaly FC
  2931: 'Аль-Фатех', // Al-Fateh
  2944: 'Аль-Фейха', // Al-Fayha
  2945: 'Аль-Хазм', // Al-Hazm
  2932: 'Аль-Хиляль', // Al-Hilal Saudi FC
  2938: 'Аль-Иттихад', // Al-Ittihad FC
  2939: 'Аль-Наср', // Al-Nassr
  2933: 'Аль-Кадсия', // Al-Qadisiyah FC
  996: 'Аланьяспор', // Alanyaspor
  542: 'Алавес', // Alaves
  778: 'Албания', // Albania
  1532: 'Алжир', // Algeria
  2553: 'Альянса Лима', // Alianza Lima
  4358: 'Алюминий', // Aluminij
  4724: 'Алверка', // Alverca
  3700: 'Олвейс Реди', // Always Ready
  3579: 'Амед', // Amed
  554: 'Андерлехт', // Anderlecht
  1110: 'Андорра', // Andorra
  77: 'Анже', // Angers
  740: 'Антверпен', // Antwerp
  3683: 'Арарат-Армения', // Ararat-Armenia
  26: 'Аргентина', // Argentina
  458: 'Архентинос Хуниорс', // Argentinos JRS
  1094: 'Армения', // Armenia
  240: 'Арока', // Arouca
  42: 'Арсенал', // Arsenal
  497: 'Рома', // AS Roma
  66: 'Астон Вилла', // Aston Villa
  499: 'Аталанта', // Atalanta
  15847: 'Атерт Биссен', // Atert Bissen
  531: 'Атлетик Бильбао', // Athletic Club
  1608: 'Атланта Юнайтед', // Atlanta United FC
  530: 'Атлетико Мадрид', // Atletico Madrid
  134: 'Атлетико Паранаэнсе', // Atletico Paranaense
  1062: 'Атлетико Минейро', // Atletico-MG
  16489: 'Остин', // Austin
  20: 'Австралия', // Australia
  775: 'Австрия', // Austria
  108: 'Осер', // Auxerre
  201: 'АЗ Алкмар', // AZ Alkmaar
  1096: 'Азербайджан', // Azerbaijan
  118: 'Баия', // Bahia
  2006: 'Балтика', // Baltika
  529: 'Барселона', // Barcelona
  1152: 'Барселона Гуаякиль', // Barcelona SC
  168: 'Байер Леверкузен', // Bayer Leverkusen
  157: 'Бавария', // Bayern München
  564: 'Истанбул Башакшехир', // Başakşehir
  1100: 'Беларусь', // Belarus
  1: 'Бельгия', // Belgium
  211: 'Бенфика', // Benfica
  549: 'Бешикташ', // Beşiktaş
  327: 'Будё-Глимт', // Bodo/Glimt
  500: 'Болонья', // Bologna
  3364: 'Борац Баня-Лука', // Borac Banja Luka
  165: 'Боруссия Дортмунд', // Borussia Dortmund
  163: 'Боруссия Мёнхенгладбах', // Borussia Mönchengladbach
  1113: 'Босния и Герцеговина', // Bosnia & Herzegovina
  120: 'Ботафого', // Botafogo
  35: 'Борнмут', // Bournemouth
  319: 'Бранн', // Brann
  6: 'Бразилия', // Brazil
  55: 'Брентфорд', // Brentford
  51: 'Брайтон', // Brighton
  1103: 'Болгария', // Bulgaria
  490: 'Кальяри', // Cagliari
  420: 'Камбюр', // Cambuur
  5529: 'Канада', // Canada
  1533: 'Кабо-Верде', // Cape Verde Islands
  2810: 'Карабобо', // Carabobo FC
  4716: 'Каза Пия', // Casa Pia
  4360: 'Целе', // Celje
  538: 'Сельта', // Celta Vigo
  247: 'Селтик', // Celtic
  741: 'Серкль Брюгге', // Cercle Brugge
  1176: 'Серро Портеньо', // Cerro Porteno
  1614: 'КФ Монреаль', // CF Montreal
  132: 'Шапекоэнсе', // Chapecoense-sc
  736: 'Шарлеруа', // Charleroi
  18310: 'Шарлотт', // Charlotte
  49: 'Челси', // Chelsea
  1607: 'Чикаго Файр', // Chicago Fire
  2383: 'Чили', // Chile
  569: 'Брюгге', // Club Brugge KV
  1174: 'Гуарани', // Club Guarani
  2356: 'Насьональ Монтевидео', // Club Nacional
  8: 'Колумбия', // Colombia
  1610: 'Колорадо Рэпидз', // Colorado Rapids
  1613: 'Коламбус Крю', // Columbus Crew
  895: 'Комо', // Como
  1508: 'ДР Конго', // Congo DR
  2330: 'Кокимбо Унидо', // Coquimbo Unido
  131: 'Коринтианс', // Corinthians
  147: 'Коритиба', // Coritiba
  29: 'Коста-Рика', // Costa Rica
  1346: 'Ковентри Сити', // Coventry
  3: 'Хорватия', // Croatia
  135: 'Крузейро', // Cruzeiro
  52: 'Кристал Пэлас', // Crystal Palace
  555: 'ЦСКА', // CSKA Moscow
  853: 'ЦСКА София', // CSKA Sofia
  5530: 'Кюрасао', // Curaçao
  10013: 'Куско', // Cusco
  1106: 'Кипр', // Cyprus
  770: 'Чехия', // Czechia
  1615: 'Ди-Си Юнайтед', // DC United
  21: 'Дания', // Denmark
  1142: 'Депортес Толима', // Deportes Tolima
  544: 'Депортиво Ла-Корунья', // Deportivo La Coruna
  2813: 'Депортиво Ла Гуайра', // Deportivo La Guaira
  2807: 'Депортиво Тачира', // Deportivo Tachira FC
  670: 'Дерри Сити', // Derry City
  6813: 'Динамо Махачкала', // Dinamo Makhachkala
  620: 'Динамо Загреб', // Dinamo Zagreb
  14281: 'Дрита', // Drita
  1088: 'Динамо', // Dynamo
  572: 'Динамо Киев', // Dynamo Kyiv
  2382: 'Эквадор', // Ecuador
  3327: 'Эгнатия', // Egnatia Rrogozhinë
  32: 'Египет', // Egypt
  169: 'Айнтрахт Франкфурт', // Eintracht Frankfurt
  797: 'Эльче', // Elche
  10: 'Англия', // England
  1009: 'Эрзурумспор', // Erzurumspor FK
  540: 'Эспаньол', // Espanyol
  110: 'Труа', // Estac Troyes
  1101: 'Эстония', // Estonia
  230: 'Эшторил Прая', // Estoril
  15130: 'Эштрела Амадора', // Estrela
  450: 'Эстудиантес', // Estudiantes L.P.
  45: 'Эвертон', // Everton
  196: 'Эксельсиор', // Excelsior
  3588: 'Эюпспор', // Eyüpspor
  1993: 'Факел', // Fakel
  242: 'Фамаликан', // Famalicao
  1098: 'Фарерские острова', // Faroe Islands
  170: 'Аугсбург', // FC Augsburg
  2242: 'Цинциннати', // FC Cincinnati
  400: 'Копенгаген', // FC Copenhagen
  1597: 'Даллас', // FC Dallas
  3502: 'Иберия 1999', // FC Iberia 1999
  621: 'Краснодар', // FC Krasnodar
  606: 'Лугано', // FC Lugano
  397: 'Мидтьюлланн', // FC Midtjylland
  398: 'Норшелланн', // FC Nordsjaelland
  1080: 'Оренбург', // FC Orenburg
  212: 'Порту', // FC Porto
  779: 'Ростов', // FC Rostov
  174: 'Шальке 04', // FC Schalke 04
  1011: 'Санкт-Галлен', // FC ST. Gallen
  1012: 'Тун', // FC Thun
  611: 'Фенербахче', // Fenerbahçe
  651: 'Ференцварош', // Ferencvarosi TC
  209: 'Фейеноорд', // Feyenoord
  1099: 'Финляндия', // Finland
  502: 'Фиорентина', // Fiorentina
  598: 'Црвена Звезда', // FK Crvena Zvezda
  1122: 'Яблонец', // FK Jablonec
  127: 'Фламенго', // Flamengo
  687: 'Флора Таллин', // Flora Tallinn
  4625: 'Флориана', // Floriana
  124: 'Флуминенсе', // Fluminense
  205: 'Фортуна Ситтард', // Fortuna Sittard
  2: 'Франция', // France
  512: 'Фрозиноне', // Frosinone
  164: 'Майнц', // FSV Mainz 05
  36: 'Фулхэм', // Fulham
  1105: 'Северная Македония', // FYR Macedonia
  645: 'Галатасарай', // Galatasaray
  3573: 'Газиантеп', // Gaziantep FK
  742: 'Генк', // Genk
  495: 'Дженоа', // Genoa
  631: 'Гент', // Gent
  997: 'Генчлербирлиги', // Gençlerbirliği S.K.
  1104: 'Грузия', // Georgia
  25: 'Германия', // Germany
  546: 'Хетафе', // Getafe
  1504: 'Гана', // Ghana
  1093: 'Гибралтар', // Gibraltar
  762: 'Жил Висенте', // GIL Vicente
  410: 'Гоу Эхед Иглз', // GO Ahead Eagles
  340: 'Гурник Забже', // Gornik Zabrze
  1117: 'Греция', // Greece
  130: 'Гремио', // Gremio
  202: 'Гронинген', // Groningen
  2402: 'Дьёр ЭТО', // Gyori ETO FC
  994: 'Гёзтепе', // Göztepe
  2386: 'Гаити', // Haiti
  175: 'Гамбург', // Hamburger SV
  363: 'Хаммарбю', // Hammarby FF
  563: 'Хапоэль Беэр-Шева', // Hapoel Beer Sheva
  254: 'Хартс', // Heart Of Midlothian
  210: 'Херенвен', // Heerenveen
  608: 'Хайдук Сплит', // HNK Hajduk Split
  1600: 'Хьюстон Динамо', // Houston Dynamo
  3723: 'Градец-Кралове', // Hradec Králové
  2328: 'Уачипато', // Huachipato
  64: 'Халл Сити', // Hull City
  769: 'Венгрия', // Hungary
  18: 'Исландия', // Iceland
  473: 'Индепендьенте Ривадавия', // Independ. Rivadavia
  1153: 'Индепендьенте дель Валье', // Independiente del Valle
  1128: 'Индепендьенте Медельин', // Independiente Medellin
  505: 'Интер', // Inter
  3342: 'Интер Эскальдес', // Inter Club d'Escaldes
  9568: 'Интер Майами', // Inter Miami
  119: 'Интернасьонал', // Internacional
  57: 'Ипсвич Таун', // Ipswich
  22: 'Иран', // Iran
  1567: 'Ирак', // Iraq
  1116: 'Израиль', // Israel
  768: 'Италия', // Italy
  1501: 'Кот-д\'Ивуар', // Ivory Coast
  336: 'Ягеллония', // Jagiellonia
  2385: 'Ямайка', // Jamaica
  12: 'Япония', // Japan
  1548: 'Иордания', // Jordan
  1135: 'Атлетико Хуниор', // Junior
  2353: 'Хувентуд Лас-Пьедрас', // Juventud
  496: 'Ювентус', // Juventus
  664: 'Кайрат', // Kairat Almaty
  1004: 'Касымпаша', // Kasımpaşa
  3872: 'Кауно Жальгирис', // Kauno Žalgiris
  1095: 'Казахстан', // Kazakhstan
  701: 'КИ Клаксвик', // KI Klaksvik
  7411: 'Коджаэлиспор', // Kocaelispor
  607: 'Коньяспор', // Konyaspor
  734: 'Кортрейк', // Kortrijk
  1111: 'Косово', // Kosovo
  1079: 'Крылья Советов', // Krylia Sovetov
  1165: 'КуПС', // KuPS
  266: 'Мехелен', // KV Mechelen
  261: 'Вестерло', // KVC Westerlo
  446: 'Ланус', // Lanus
  5354: 'Ларн', // Larne
  1026: 'ЛАСК', // Lask Linz
  1092: 'Латвия', // Latvia
  487: 'Лацио', // Lazio
  1158: 'ЛДУ Кито', // LDU de Quito
  111: 'Гавр', // Le Havre
  1298: 'Ле Ман', // Le Mans
  867: 'Лечче', // Lecce
  347: 'Лех Познань', // Lech Poznan
  63: 'Лидс Юнайтед', // Leeds
  116: 'Ланс', // Lens
  539: 'Леванте', // Levante
  646: 'Левски', // Levski Sofia
  1179: 'Либертад', // Libertad Asuncion
  1107: 'Лихтенштейн', // Liechtenstein
  79: 'Лилль', // Lille
  321: 'Лиллестрём', // Lillestrom
  667: 'Линкольн Ред Импс', // Lincoln Red Imps FC
  1097: 'Литва', // Lithuania
  40: 'Ливерпуль', // Liverpool
  2358: 'Ливерпуль Монтевидео', // Liverpool Montevideo
  597: 'Локомотив', // Lokomotiv
  259: 'Ломмел', // Lommel United
  97: 'Лорьян', // Lorient
  1616: 'Лос-Анджелес', // Los Angeles FC
  1605: 'ЛА Гэлакси', // Los Angeles Galaxy
  1102: 'Люксембург', // Luxembourg
  80: 'Лион', // Lyon
  604: 'Маккаби Тель-Авив', // Maccabi Tel Aviv
  535: 'Малага', // Malaga
  1112: 'Мальта', // Malta
  50: 'Манчестер Сити', // Manchester City
  33: 'Манчестер Юнайтед', // Manchester United
  214: 'Маритиму', // Maritimo
  81: 'Марсель', // Marseille
  16: 'Мексика', // Mexico
  1612: 'Миннесота Юнайтед', // Minnesota United FC
  7848: 'Мирасол', // Mirassol
  2240: 'Мьельбю', // Mjallby AIF
  7808: 'Макслайн Витебск', // ML Vitebsk
  1114: 'Молдова', // Moldova
  91: 'Монако', // Monaco
  1109: 'Черногория', // Montenegro
  1579: 'Монца', // Monza
  215: 'Морейренсе', // Moreirense
  31: 'Марокко', // Morocco
  225: 'Насьонал', // Nacional
  492: 'Наполи', // Napoli
  9569: 'Нэшвилл', // Nashville SC
  413: 'НЕК Неймеген', // NEC Nijmegen
  10513: 'Неом', // NEOM
  1118: 'Нидерланды', // Netherlands
  1609: 'Нью-Ингленд Революшн', // New England Revolution
  1604: 'Нью-Йорк Сити', // New York City FC
  1602: 'Нью-Йорк Ред Буллз', // New York Red Bulls
  4673: 'Новая Зеландия', // New Zealand
  34: 'Ньюкасл Юнайтед', // Newcastle
  84: 'Ницца', // Nice
  771: 'Северная Ирландия', // Northern Ireland
  1090: 'Норвегия', // Norway
  65: 'Ноттингем Форест', // Nottingham Forest
  2320: 'О\'Хиггинс', // O'Higgins
  1124: 'ОФИ', // OFI
  260: 'Ауд-Хеверле Лёвен', // OH Leuven
  553: 'Олимпиакос', // Olympiakos Piraeus
  3402: 'Омония', // Omonia Nicosia
  1598: 'Орландо Сити', // Orlando City SC
  727: 'Осасуна', // Osasuna
  3403: 'Пафос', // Pafos
  121: 'Палмейрас', // Palmeiras
  11: 'Панама', // Panama
  617: 'Панатинаикос', // Panathinaikos
  619: 'ПАОК', // PAOK
  2380: 'Парагвай', // Paraguay
  114: 'Париж ФК', // Paris FC
  85: 'ПСЖ', // Paris Saint Germain
  523: 'Парма', // Parma
  193: 'ПЕК Зволле', // PEC Zwolle
  2348: 'Пеньяроль', // Penarol
  30: 'Перу', // Peru
  2271: 'Петрокуб', // Petrocub
  1599: 'Филадельфия Юнион', // Philadelphia Union
  1064: 'Платенсе', // Platense
  567: 'Виктория Пльзень', // Plzen
  24: 'Польша', // Poland
  1617: 'Портленд Тимберс', // Portland Timbers
  27: 'Португалия', // Portugal
  197: 'ПСВ', // PSV Eindhoven
  556: 'Карабах', // Qarabag
  1569: 'Катар', // Qatar
  5902: 'Ла-Лувьер', // RAAL La Louvière
  4665: 'Расинг Сантандер', // Racing Santander
  257: 'Рейнджерс', // Rangers
  728: 'Райо Вальекано', // Rayo Vallecano
  794: 'Брагантино', // RB Bragantino
  173: 'РБ Лейпциг', // RB Leipzig
  543: 'Реал Бетис', // Real Betis
  541: 'Реал Мадрид', // Real Madrid
  1606: 'Реал Солт-Лейк', // Real Salt Lake
  548: 'Реал Сосьедад', // Real Sociedad
  571: 'Ред Булл Зальцбург', // Red Bull Salzburg
  1198: 'Ремо', // Remo
  94: 'Ренн', // Rennes
  776: 'Ирландия', // Rep. Of Ireland
  10124: 'Рига', // Riga
  2263: 'Рига', // Riga FC
  226: 'Риу Аве', // Rio Ave
  1007: 'Ризеспор', // Rizespor
  6822: 'Родина', // Rodina Moskva
  774: 'Румыния', // Romania
  437: 'Росарио Сентраль', // Rosario Central
  1083: 'Рубин', // Rubin
  13976: 'Сабах', // Sabah FA
  3603: 'Самсунспор', // Samsunspor
  25484: 'Сан-Диего', // San Diego
  1596: 'Сан-Хосе Эртквейкс', // San Jose Earthquakes
  1115: 'Сан-Марино', // San Marino
  227: 'Санта-Клара', // Santa Clara
  128: 'Сантос', // Santos
  126: 'Сан-Паулу', // Sao Paulo
  488: 'Сассуоло', // Sassuolo
  23: 'Саудовская Аравия', // Saudi Arabia
  217: 'Брага', // SC Braga
  160: 'Фрайбург', // SC Freiburg
  185: 'Падерборн', // SC Paderborn 07
  1108: 'Шотландия', // Scotland
  1595: 'Сиэтл Саундерс', // Seattle Sounders
  13: 'Сенегал', // Senegal
  14: 'Сербия', // Serbia
  536: 'Севилья', // Sevilla
  550: 'Шахтёр', // Shakhtar Donetsk
  652: 'Шемрок Роверс', // Shamrock Rovers
  568: 'Шериф', // Sheriff Tiraspol
  738: 'Беверен', // SK Beveren
  560: 'Славия', // Slavia Praha
  773: 'Словакия', // Slovakia
  656: 'Слован', // Slovan Bratislava
  1091: 'Словения', // Slovenia
  1531: 'ЮАР', // South Africa
  17: 'Южная Корея', // South Korea
  9: 'Испания', // Spain
  628: 'Спарта', // Sparta Praha
  426: 'Спарта Роттердам', // Sparta Rotterdam
  558: 'Спартак', // Spartak Moscow
  1120: 'Спартак Трнава', // Spartak Trnava
  228: 'Спортинг', // Sporting CP
  1611: 'Спортинг Канзас-Сити', // Sporting Kansas City
  20787: 'Сент-Луис Сити', // St. Louis City
  735: 'Синт-Трёйден', // St. Truiden
  106: 'Брест', // Stade Brestois 29
  733: 'Стандард Льеж', // Standard Liege
  95: 'Страсбур', // Strasbourg
  637: 'Штурм', // Sturm Graz
  746: 'Сандерленд', // Sunderland
  673: 'Сутьеска', // Sutjeska
  1660: 'Эльферсберг', // SV Elversberg
  5: 'Швеция', // Sweden
  15: 'Швейцария', // Switzerland
  427: 'Телстар', // Telstar
  354: 'Нью-Сейнтс', // The New Saints
  3711: 'Стронгест', // The Strongest
  503: 'Торино', // Torino
  1601: 'Торонто', // Toronto FC
  4799: 'Торренсе', // Torreense
  47: 'Тоттенхэм Хотспур', // Tottenham
  96: 'Тулуза', // Toulouse
  998: 'Трабзонспор', // Trabzonspor
  2260: 'Тре Фиори', // Tre Fiori
  325: 'Тромсё', // Tromso
  28: 'Тунис', // Tunisia
  415: 'Твенте', // Twente
  777: 'Турция', // Türkiye
  494: 'Удинезе', // Udinese
  772: 'Украина', // Ukraine
  182: 'Унион Берлин', // Union Berlin
  1393: 'Юнион Сент-Жиллуаз', // Union St. Gilloise
  1157: 'Универсидад Католика Эквадор', // Universidad Catolica
  2540: 'Университарио', // Universitario
  2599: 'Университатя Клуж', // Universitatea Cluj
  632: 'Университатя Крайова', // Universitatea Craiova
  7: 'Уругвай', // Uruguay
  2384: 'США', // USA
  207: 'Утрехт', // Utrecht
  1568: 'Узбекистан', // Uzbekistan
  532: 'Валенсия', // Valencia
  1603: 'Ванкувер Уайткэпс', // Vancouver Whitecaps
  574: 'Вардар', // Vardar Skopje
  133: 'Васко да Гама', // Vasco DA Gama
  517: 'Венеция', // Venezia
  2379: 'Венесуэла', // Venezuela
  4165: 'Вестри', // Vestri
  172: 'Штутгарт', // VfB Stuttgart
  759: 'Викинг', // Viking
  278: 'Викингур Рейкьявик', // Vikingur Reykjavik
  533: 'Вильярреал', // Villarreal
  136: 'Витория', // Vitoria
  224: 'Витория Гимарайнш', // Vitória SC
  702: 'Воеводина', // Vojvodina
  767: 'Уэльс', // Wales
  162: 'Вердер', // Werder Bremen
  195: 'Виллем II', // Willem II
  596: 'Зенит', // Zenit
  600: 'Зюлте-Варегем', // Zulte Waregem
  6343: 'Чорум', // Çorum FK
  3554: 'Жилина', // Žilina
}

/** Название команды по-русски по её номеру в API-Football; перевода или номера нет — название из API */
export function getTeamName(id: number | null, name: string | null): string {
  return (id != null && TEAM_NAMES[id]) || decodeEntities(name ?? '')
}
