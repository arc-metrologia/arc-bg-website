<?php
declare(strict_types=1);

/**
 * Начално съдържание, базирано на текущия www.arc-bg.com.
 * Снимките се изтеглят от стария сайт и минават през същата оптимизация като качените от админ панела.
 * Текстовете са отправна точка — редакторите трябва да ги прегледат и допълнят.
 */

function b(string $type, array $fields = []): array
{
    return $fields + ['id' => bin2hex(random_bytes(6)), 'type' => $type, 'heading' => ''];
}

function import_image(string $url, string $altBg, string $altEn = ''): ?int
{
    $data = @file_get_contents($url);
    if ($data === false) {
        echo "  ! не успях да изтегля $url\n";
        return null;
    }
    $tmp = tempnam(sys_get_temp_dir(), 'arc');
    file_put_contents($tmp, $data);
    try {
        $m = Media::upload(['error' => UPLOAD_ERR_OK, 'size' => strlen($data), 'tmp_name' => $tmp, 'name' => basename(parse_url($url, PHP_URL_PATH))], 0);
    } catch (Throwable $e) {
        echo "  ! $url: {$e->getMessage()}\n";
        return null;
    } finally {
        @unlink($tmp);
    }
    Db::update('media', ['alt_bg' => $altBg, 'alt_en' => $altEn], $m['id']);
    echo "  + {$m['url']}\n";
    return $m['id'];
}

function page(string $lang, string $path, string $type, string $title, string $excerpt, array $blocks, array $opt = []): int
{
    $id = Db::insert('pages', [
        'type' => $type,
        'lang' => $lang,
        'path' => $path,
        'translation_key' => $opt['key'] ?? null,
        'title' => $title,
        'meta_title' => $opt['metaTitle'] ?? '',
        'meta_description' => $opt['meta'] ?? $excerpt,
        'excerpt' => $excerpt,
        'image_id' => $opt['image'] ?? null,
        'blocks' => json_encode(Sanitizer::blocks($blocks), JSON_UNESCAPED_UNICODE),
        'related' => json_encode($opt['related'] ?? []),
        'extra' => json_encode($opt['extra'] ?? new stdClass(), JSON_UNESCAPED_UNICODE),
        'status' => 'published',
        'sort_order' => $opt['sort'] ?? 0,
        'published_at' => $opt['date'] ?? now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    echo "  page " . Content::url($lang, $path) . "\n";
    return $id;
}

/**
 * Задължителна публичност по ОПИК — пренесена дословно от www.arc-bg.com/177-…, с оригиналната дата.
 * Отделна функция, за да може да се добави и към съществуваща база.
 */
function seed_grant_news(): void
{
    $path = 'blog/ark-metrologiya-poluchi-bezvazmezdna-finansova-pomosht';
    if (Db::val('SELECT id FROM pages WHERE lang = ? AND path = ?', ['bg', $path])) {
        return;
    }
    $old = 'https://www.arc-bg.com';
    $photo = import_image("$old/static/pages/big/arc-metrology-signed-a-grant-agreement-1de6c368a5ce523ca3f48f6c21eb8ec0.jpg", 'АРК Метрология подписа договор за безвъзмездна финансова помощ по ОПИК', 'ARC Metrologia signed a grant agreement under OPIC');
    $eu = import_image("$old/arcsite/ckfinder/userfiles/files/Eu%20funds.jpg", 'Европейски съюз, Европейски фонд за регионално развитие и Оперативна програма „Иновации и конкурентоспособност“ 2014–2020', 'EU, ERDF and OP Innovation and Competitiveness logos');
    page('bg', $path, 'post', 'АРК Метрология получи безвъзмездна финансова помощ по процедура BG16RFOP002-2.073', 'Безвъзмездна финансова помощ по ОПИК 2014–2020 за преодоляване на икономическите последствия от пандемията COVID-19.', [
        b('richtext', ['html' => '<p>АРК Метрология получи безвъзмездна финансова помощ по процедура BG16RFOP002-2.073 „Подкрепа на микро и малки предприятия за преодоляване на икономическите последствия от пандемията COVID-19“ по Оперативна програма „Иновации и конкурентоспособност“ (ОПИК) 2014-2020.</p><p>Финансирането е по проект „Преодоляване недостига на средства и липсата на ликвидност, настъпили в резултат от епидемичния взрив от COVID-19“.</p><p>Целта на проекта е осигуряване на оперативен капитал за българските микро и малки предприятия за справяне с последиците от пандемията COVID-19.</p><p>Очакваните резултати от подкрепата по процедурата се изразяват в постигане на положителен ефект по отношение на микро и малки предприятия за преодоляване на икономическите последствия от пандемията COVID-19 и стабилност на работните места.</p><p>Процедурата се реализира с финансовата подкрепа на Европейския съюз чрез Европейския фонд за регионално развитие.</p>']),
        b('specs', ['heading' => 'Данни за проекта', 'rows' => [
            ['label' => 'Проект и главна цел', 'value' => 'Преодоляване недостига на средства и липсата на ликвидност, настъпили в резултат от епидемичния взрив от COVID-19'],
            ['label' => 'Обща стойност', 'value' => '10 000.00 лв., от които 8 500.00 лв. европейско и 1 500.00 лв. национално съфинансиране'],
            ['label' => 'Начало', 'value' => '20.08.2020 г.'],
            ['label' => 'Край', 'value' => '19.11.2020 г.'],
        ]]),
        b('image', ['image' => $eu, 'caption' => '']),
    ], ['image' => $photo, 'date' => '2020-08-26 10:00:00']);

    $redirects = Db::setting('redirects', []);
    $redirects['/177-ark-metrologiq-poluchi-bezvyzmezdna-finansova-pomosht-po-procedur'] = "/$path";
    Db::saveSetting('redirects', $redirects);
}

function seed(): void
{
    if ((int)Db::val('SELECT COUNT(*) FROM pages') > 0) {
        echo "Базата вече има съдържание — seed е пропуснат.\n";
        return;
    }
    $old = 'https://www.arc-bg.com';

    // ------------------------------------------------------------ настройки
    Db::saveSetting('site', [
        'name' => 'АРК Метрология',
        'nameEn' => 'ARC Metrologia',
        'legalName' => 'АРК Метрология ООД',
        'phone' => '+359 876 149 905',
        'email' => 'arc@arc-bg.com',
        'address' => [
            'bg' => 'ул. Костенски водопад 47, 1404 София',
            'en' => '47 Kostenski Vodopad St, 1404 Sofia, Bulgaria',
        ],
        'postal' => [
            'street' => ['bg' => 'ул. Костенски водопад 47', 'en' => '47 Kostenski Vodopad St'],
            'city' => ['bg' => 'София', 'en' => 'Sofia'],
            'postalCode' => '1404',
            'country' => 'BG',
        ],
        'tagline' => [
            'bg' => 'Измервателни машини, калибриране и сервиз',
            'en' => 'Measuring machines, calibration and service',
        ],
        'description' => [
            'bg' => 'АРК Метрология ООД е официален представител на Hexagon Manufacturing Intelligence, TESA, Sylvac и TRIMOS за България. Доставяме, инсталираме, калибрираме и поддържаме трикоординатни измервателни машини, измервателни ръце, лазерни трекери, 3D скенери и ръчни измервателни инструменти. Оторизиран сервиз и обучение на български език от 2004 г.',
            'en' => 'ARC Metrologia Ltd is the official representative of Hexagon Manufacturing Intelligence, TESA, Sylvac and TRIMOS in Bulgaria. We supply, install, calibrate and service coordinate measuring machines, portable measuring arms, laser trackers, 3D scanners and hand-held measuring instruments, with authorised service and training in Bulgarian since 2004.',
        ],
        'knowsAbout' => [
            'bg' => ['Трикоординатни измервателни машини', 'Калибриране по ISO 10360-2', 'Измервателни ръце', 'Лазерни трекери', '3D сканиране', 'PC-DMIS', 'Метрология'],
            'en' => ['Coordinate measuring machines', 'ISO 10360-2 calibration', 'Portable measuring arms', 'Laser trackers', '3D scanning', 'PC-DMIS', 'Dimensional metrology'],
        ],
        'brands' => ['HEXAGON', 'TESA', 'Sylvac', 'TRIMOS', 'LTF', 'Borletti', 'DEMM', 'Fer Ter', 'DK Fixiersysteme', 'PC-DMIS', 'PolyWorks'],
        'social' => [
            ['label' => 'LinkedIn', 'url' => 'https://www.linkedin.com/company/arc-metrologia'],
            ['label' => 'YouTube', 'url' => 'https://www.youtube.com/channel/UCJYDKUoHs0QWHiKDJ7tEurw'],
            ['label' => 'Facebook', 'url' => 'https://www.facebook.com/profile.php?id=100086206818585'],
        ],
    ]);
    Db::saveSetting('nav_bg', [
        ['label' => 'Продукти', 'url' => '/produkti', 'children' => [
            ['label' => 'Трикоординатни машини HEXAGON', 'url' => '/produkti/trikoordinatni-mashini-hexagon'],
            ['label' => 'Измервателна ръка Absolute Arm', 'url' => '/produkti/izmervatelna-raka-absolute-arm'],
            ['label' => 'Оптична машина Sylvac Scan', 'url' => '/produkti/sylvac-scan-s25'],
            ['label' => 'Лазерни трекери', 'url' => '/produkti/lazerni-trekeri'],
            ['label' => 'Инструменти TESA', 'url' => '/produkti/izmervatelni-instrumenti-tesa'],
            ['label' => 'Софтуер PC-DMIS', 'url' => '/produkti/softuer-pc-dmis'],
        ]],
        ['label' => 'Услуги', 'url' => '/uslugi', 'children' => [
            ['label' => 'Калибриране', 'url' => '/uslugi/kalibrirane'],
            ['label' => 'Сервиз и поддръжка', 'url' => '/uslugi/serviz-i-poddrazhka'],
            ['label' => 'Обучение', 'url' => '/uslugi/obuchenie'],
            ['label' => 'Детайл-програми', 'url' => '/uslugi/detail-programi'],
            ['label' => 'Измерване на детайли', 'url' => '/uslugi/izmervane-na-detaili'],
        ]],
        ['label' => 'За нас', 'url' => '/za-nas'],
        ['label' => 'Блог', 'url' => '/blog'],
        ['label' => 'Контакти', 'url' => '/kontakti'],
    ]);
    Db::saveSetting('nav_en', [
        ['label' => 'Services', 'url' => '/en/services/calibration'],
        ['label' => 'About', 'url' => '/en/about'],
        ['label' => 'Contact', 'url' => '/en/contact'],
    ]);
    // Стари адреси → нови (301). Запазва позициите в Google и външните връзки.
    Db::saveSetting('redirects', [
        '/about' => '/za-nas',
        '/about/team' => '/za-nas',
        '/contact' => '/kontakti',
        '/264-blog' => '/blog',
        '/231-novini' => '/blog',
        '/3-kalibrirane-na-izmervatelni-mashini' => '/uslugi/kalibrirane',
        '/4-services-and-maintanence' => '/uslugi/serviz-i-poddrazhka',
        '/6-obuchenie-za-nachinaeshti-ili-naprednali' => '/uslugi/obuchenie',
        '/8-syzdavane-na-detail-programi' => '/uslugi/detail-programi',
        '/9-izmervane-na-detaili' => '/uslugi/izmervane-na-detaili',
        '/30-dogovor-za-servizno-obslujvane' => '/uslugi/serviz-i-poddrazhka',
        '/28-instalaciq' => '/uslugi',
        '/29-rezervni-chasti' => '/uslugi/serviz-i-poddrazhka',
        '/310-trikoordinatni-izmervatelni-mashini-hexagon' => '/produkti/trikoordinatni-mashini-hexagon',
        '/2-portalni-izmervatelni-mashini' => '/produkti/trikoordinatni-mashini-hexagon',
        '/33-izmervatelni-ryce-romer-absolute-arm-ot-hexagon-mi' => '/produkti/izmervatelna-raka-absolute-arm',
        '/32-7-osna-izmervatelna-ryka-romer-absolute-arm' => '/produkti/izmervatelna-raka-absolute-arm',
        '/233-optichna-izmervatelni-mashini-sylvac-scan' => '/produkti/sylvac-scan-s25',
        '/235-sylvac-scan-s25t' => '/produkti/sylvac-scan-s25',
        '/41-lazerni-trekeri' => '/produkti/lazerni-trekeri',
        '/20-izmervatelni-instrumenti-tesa' => '/produkti/izmervatelni-instrumenti-tesa',
        '/20-izmervatelni-instrumenti-tesa-shveicariq' => '/produkti/izmervatelni-instrumenti-tesa',
        '/19-pc-dmis' => '/produkti/softuer-pc-dmis',
        '/en' => '/en/',
    ]);

    // ------------------------------------------------------------ медия
    echo "Изображения:\n";
    $img = [
        'global' => import_image("$old/arcsite/ckfinder/userfiles/files/Global-S_M.jpg", 'Трикоординатна измервателна машина HEXAGON Global S с портална конструкция', 'HEXAGON Global S bridge coordinate measuring machine'),
        'scan' => import_image("$old/arcsite/ckfinder/userfiles/files/SCAN_S25-new_big_138-SansTilt.png", 'Оптична измервателна машина Sylvac Scan S25 за ротационни детайли', 'Sylvac Scan S25 optical shaft measuring machine'),
        'hexagon' => import_image("$old/arcsite/ckfinder/userfiles/files/QM0318-DEPT-Products-p2-Hexagon.jpg", 'Измервателни системи HEXAGON за производството', 'HEXAGON measuring systems for manufacturing'),
        'tesa' => import_image("$old/static/pages/big/measuring-instruments-tesa-switzerland-88a3f518480419cfacb015b1b2041ffb.png", 'Ръчни измервателни инструменти TESA — шублери, микрометри, индикатори', 'TESA hand-held measuring instruments'),
        'trimos' => import_image("$old/static/pages/big/measuring-machines-trimos-f48430997998bd7dd9764ceabaec74f2.png", 'Височиномер и дължиномер TRIMOS', 'TRIMOS height and length gauges'),
        'sylvac' => import_image("$old/static/pages/big/measuring-machines-and-instruments-trimos-28cd9f6330b87c004b6e665713640080.jpg", 'Измервателни инструменти Sylvac', 'Sylvac measuring instruments'),
        'process' => import_image("$old/static/arctheme/images/process.png", 'Схема на процеса: задача, решение, доставка и поддръжка', 'Process diagram'),
    ];
    $logos = [];
    $partners = [
        'e23d7aa24c43e77927b65ac9183b0bec' => 'HEXAGON Manufacturing Intelligence',
        'c6b0731fa1e28ab4e8e4d58a7cb036da' => 'Renishaw',
        '028f3d932e4d43159a1def7c2020c59d' => 'Sylvac',
        'e9e81cf6e2441b195ac61235944daf1c' => 'LTF',
        'ff7cc3f9ec68ec1d666a2fcffd81d523' => 'DK Fixiersysteme',
        '1f544043e9742e8fb62a34aa7cc4d11d' => 'Microrep',
    ];
    foreach ($partners as $h => $brand) {
        $logos[] = import_image("$old/static/gallery_images/big/$h.png", "Лого на $brand", "$brand logo");
    }
    $logos = array_values(array_filter($logos));

    echo "Страници:\n";
    $cta = fn() => b('cta', [
        'heading' => 'Безплатна демонстрация в София',
        'text' => 'Елате в демонстрационния ни център за един час с машината и вашия детайл. Заявете час по телефона или с формата за контакт.',
        'label' => 'Заявете демонстрация',
        'url' => '/kontakti',
    ]);

    // ------------------------------------------------------------ продукти
    page('bg', 'produkti', 'category', 'Продукти', 'Трикоординатни машини, измервателни ръце, лазерни трекери, оптични и ръчни измервателни инструменти от HEXAGON, TESA, Sylvac и TRIMOS.', [
        b('richtext', ['html' => '<p>Подбираме оборудването според детайлите, точността и производствената среда на клиента. Преди покупка можем да измерим ваш детайл и да ви дадем протокол, за да сравните решенията с реални данни.</p>']),
        b('listing', ['heading' => 'Продуктови групи', 'source' => 'children']),
        b('logos', ['heading' => 'Марки, които представяме', 'images' => $logos]),
        $cta(),
    ], ['sort' => 1]);

    $cmm = page('bg', 'produkti/trikoordinatni-mashini-hexagon', 'product', 'Трикоординатни измервателни машини HEXAGON', 'Стационарни портални трикоординатни машини HEXAGON Global за измервателна лаборатория и производствен цех.', [
        b('richtext', ['html' => '<p>HEXAGON Global е серия портални трикоординатни измервателни машини (ТИМ/CMM) за контрол на геометрията на детайли с висока точност. Предлага се в три класа на производителност — <strong>Green</strong>, <strong>Blue</strong> и <strong>Chrome</strong> — така че точността и скоростта да отговарят на задачата, без да се плаща за излишни възможности.</p><p>Машините работят с контактни и сканиращи сонди и с безконтактни лазерни сензори. Управляват се със софтуера PC-DMIS, за който провеждаме обучение на български език.</p>']),
        b('specs', ['heading' => 'Основни параметри', 'rows' => [
            ['label' => 'Максимален измервателен обхват', 'value' => 'X 2000 × Y 4000 × Z 1800 mm'],
            ['label' => 'Класове на производителност', 'value' => 'Green, Blue, Chrome'],
            ['label' => 'Температурен диапазон', 'value' => '16–26 °C'],
            ['label' => 'Софтуер', 'value' => 'PC-DMIS'],
            ['label' => 'Калибриране', 'value' => 'ISO 10360-2, при инсталация и периодично'],
        ]]),
        b('faq', ['heading' => 'Често задавани въпроси', 'items' => [
            ['q' => 'Колко често трябва да се калибрира трикоординатна машина?', 'a' => 'Стандартите за управление на качеството (ISO) изискват калибриране поне веднъж годишно. Препоръчваме допълнителна проверка след преместване на машината или при съмнение за точността.'],
            ['q' => 'Нужно ли е климатизирано помещение?', 'a' => 'Машините HEXAGON Global работят в температурен диапазон 16–26 °C. Преди доставка ви даваме указания за подготовка на помещението и основата.'],
            ['q' => 'Може ли да видим машината в работа преди покупка?', 'a' => 'Да. В демонстрационния ни център в София предлагаме безплатна едночасова демонстрация, включително измерване на ваш детайл.'],
        ]]),
        $cta(),
    ], ['image' => $img['global'], 'extra' => ['brand' => 'HEXAGON'], 'sort' => 1]);

    $arm = page('bg', 'produkti/izmervatelna-raka-absolute-arm', 'product', 'Измервателна ръка HEXAGON Absolute Arm', 'Преносима 7-осна измервателна ръка с обхват от 1,2 до 4,5 m и интегриран лазерен скенер AS1.', [
        b('richtext', ['html' => '<p>Absolute Arm е преносима координатна измервателна машина, която се носи до детайла, а не обратното. Подходяща е за едрогабаритни детайли, приспособления и проверка директно в цеха.</p><ul><li>7-осна конструкция с абсолютни енкодери — не изисква нулиране при включване</li><li>Обхват от 1,2 до 4,5 m</li><li>Интегриран лазерен скенер AS1 за безконтактно сканиране</li><li>Сертифицирана точност по ISO 10360-12</li></ul>']),
        b('specs', ['heading' => 'Основни параметри', 'rows' => [
            ['label' => 'Брой оси', 'value' => '7'],
            ['label' => 'Измервателен обхват', 'value' => '1,2–4,5 m'],
            ['label' => 'Лазерен скенер', 'value' => 'HEXAGON AS1'],
            ['label' => 'Стандарт', 'value' => 'ISO 10360-12'],
        ]]),
        $cta(),
    ], ['extra' => ['brand' => 'HEXAGON'], 'sort' => 2]);

    $scan = page('bg', 'produkti/sylvac-scan-s25', 'product', 'Оптична измервателна машина Sylvac Scan S25', 'Вертикална оптична машина за ротационно-симетрични детайли до Ø26 mm — пълно измерване за под 3 секунди.', [
        b('richtext', ['html' => '<p>Sylvac Scan S25 измерва безконтактно валове, щифтове, винтове и други ротационно-симетрични детайли. Детайлът се поставя вертикално, а машината сканира профила му и изчислява диаметри, дължини, ъгли, радиуси и резби за секунди.</p><p>Подходяща е за контрол непосредствено до машината в производството, където е важна скоростта, а не само точността.</p>']),
        b('specs', ['heading' => 'Технически данни', 'rows' => [
            ['label' => 'Максимален диаметър', 'value' => 'Ø26 mm'],
            ['label' => 'Максимална дължина', 'value' => '200 mm'],
            ['label' => 'Разделителна способност', 'value' => '0,0001 mm'],
            ['label' => 'Време за сканиране', 'value' => 'под 3 s'],
            ['label' => 'Софтуер', 'value' => 'REFLEX SCAN+'],
        ]]),
        $cta(),
    ], ['image' => $img['scan'], 'extra' => ['brand' => 'Sylvac'], 'sort' => 3]);

    page('bg', 'produkti/lazerni-trekeri', 'product', 'Лазерни трекери', 'Лазерни трекери HEXAGON Leica за измерване на големи обекти с висока точност — от машиностроене до енергетика.', [
        b('richtext', ['html' => '<p>Лазерният трекер измерва точки в обем с размери от няколко метра до десетки метри. Използва се за настройка на машини и приспособления, проверка на големи заварени конструкции, форми и възли в авиационната, автомобилната и енергийната индустрия.</p><p>Свържете се с нас, за да обсъдим изискванията за обхват, точност и среда — ще предложим подходящия модел и аксесоари.</p>']),
        $cta(),
    ], ['extra' => ['brand' => 'HEXAGON'], 'sort' => 4]);

    page('bg', 'produkti/izmervatelni-instrumenti-tesa', 'product', 'Измервателни инструменти TESA', 'Швейцарски шублери, микрометри, индикатори и височиномери TESA за цеха и лабораторията.', [
        b('richtext', ['html' => '<p>TESA (Швейцария) произвежда ръчни измервателни инструменти и височиномери, които се използват всеки ден в производството: шублери, микрометри, индикаторни часовници, контролни уреди и височиномери TESA-HITE.</p><p>Доставяме и инструменти Sylvac, LTF и Borletti, DEMM и калибри Fer Ter. Помагаме при избора според допуска на детайла и условията на работа.</p>']),
        b('gallery', ['heading' => 'Инструменти', 'images' => array_values(array_filter([$img['tesa'], $img['sylvac'], $img['trimos']]))]),
        $cta(),
    ], ['image' => $img['tesa'], 'extra' => ['brand' => 'TESA'], 'sort' => 5]);

    $pcdmis = page('bg', 'produkti/softuer-pc-dmis', 'product', 'Софтуер PC-DMIS', 'PC-DMIS — софтуер за програмиране на трикоординатни машини, анализ на резултати и отчети по GD&T.', [
        b('richtext', ['html' => '<p>PC-DMIS е най-разпространеният софтуер за трикоординатни измервателни машини. С него се създават детайл-програми от CAD модел, извършва се анализ по геометрични допуски (GD&amp;T) и се генерират протоколи за клиента.</p><p>Предлагаме лицензи, актуализации, обучение за начинаещи и напреднали и създаване на детайл-програми по поръчка.</p>']),
        $cta(),
    ], ['extra' => ['brand' => 'PC-DMIS'], 'sort' => 6]);

    // ------------------------------------------------------------ услуги
    page('bg', 'uslugi', 'category', 'Услуги', 'Инсталация, калибриране, сервиз, обучение, детайл-програми и измерване на детайли — за целия живот на измервателната машина.', [
        b('richtext', ['html' => '<p>Поддържаме оборудването, което сме доставили, а и машини, закупени от други доставчици. Сервизът ни е оторизиран за България и се извършва от наши инженери.</p>']),
        b('listing', ['heading' => 'Какво правим', 'source' => 'children']),
        $cta(),
    ], ['sort' => 2]);

    $cal = page('bg', 'uslugi/kalibrirane', 'service', 'Калибриране на измервателни машини', 'Калибриране на трикоординатни машини по ISO 10360-2 с издаване на калибрационен сертификат — ежегодно или при съмнение за точността.', [
        b('richtext', ['html' => '<p>Калибрираме трикоординатни измервателни машини и издаваме калибрационен сертификат. На разположение сме както за задължителното ежегодно калибриране, така и за проверка при съмнение в точността.</p><h2>Кога е нужно калибриране</h2><ul><li>След инсталация или преместване на машината</li><li>Веднъж годишно, според изискванията на ISO системите за качество</li><li>След авария, удар или ремонт</li><li>Когато резултатите от измерванията изглеждат съмнителни</li></ul>']),
        b('faq', ['heading' => 'Въпроси за калибрирането', 'items' => [
            ['q' => 'По какъв стандарт калибрирате?', 'a' => 'Трикоординатните машини се калибрират по ISO 10360-2 от обучени инженери, с еталони с проследимост.'],
            ['q' => 'Колко време е машината извън работа?', 'a' => 'Обикновено калибрирането отнема един работен ден на място при клиента. Точната продължителност зависи от размера и типа на машината.'],
            ['q' => 'Калибрирате ли машини, които не сте доставили вие?', 'a' => 'Да. Свържете се с нас с модела и годината на машината, за да потвърдим.'],
        ]]),
        $cta(),
    ], ['sort' => 1, 'key' => 'calibration', 'related' => [$cmm, $arm]]);

    $srv = page('bg', 'uslugi/serviz-i-poddrazhka', 'service', 'Сервиз и поддръжка', 'Гаранционен и извънгаранционен сервиз, резервни части и годишно абонаментно обслужване на измервателни машини и софтуер.', [
        b('richtext', ['html' => '<p>Като оторизиран сервиз за България поддържаме машините в гаранция и след нея. Осигуряваме резервни части, превантивна поддръжка и бърза реакция при авария.</p><h2>Годишен абонамент</h2><p>Абонаментът включва планирана поддръжка, обучение на място, онлайн и телефонна поддръжка и периодична проверка на точността. Така разходите са предвидими, а машината — в работа.</p>']),
        $cta(),
    ], ['sort' => 2, 'related' => [$cal]]);

    $train = page('bg', 'uslugi/obuchenie', 'service', 'Обучение за начинаещи и напреднали', 'Обучение на оператори на трикоординатни машини и PC-DMIS на български език — начален курс, напреднали и опреснителни курсове.', [
        b('richtext', ['html' => '<p>Обучаваме операторите да работят самостоятелно с машината и софтуера. Курсовете са на български език и се провеждат в нашия център или на място при клиента.</p>']),
        b('steps', ['heading' => 'Нива на обучение', 'items' => [
            ['title' => 'Начален курс', 'text' => 'Работа с машината, сонди, координатни системи, основни измервания и протоколи.'],
            ['title' => 'Напреднали', 'text' => 'Сканиране, геометрични допуски (GD&T), програмиране по CAD модел, автоматизация.'],
            ['title' => 'Опреснителен курс', 'text' => 'За нови служители или след обновяване на софтуера.'],
        ]]),
        $cta(),
    ], ['sort' => 3, 'related' => [$pcdmis]]);

    page('bg', 'uslugi/detail-programi', 'service', 'Създаване на детайл-програми', 'Създаваме измервателни програми за вашите детайли — еднократно или по абонамент.', [
        b('richtext', ['html' => '<p>Когато нямате време или опит да програмирате нов детайл, нашите инженери създават детайл-програмата вместо вас по чертеж или CAD модел. Програмата се предава готова за серийно измерване, с протокол по вашите изисквания.</p>']),
        $cta(),
    ], ['sort' => 4, 'related' => [$pcdmis, $cmm]]);

    page('bg', 'uslugi/izmervane-na-detaili', 'service', 'Измерване на детайли', 'Измерване на детайли по поръчка с трикоординатна машина и протокол от измерването.', [
        b('richtext', ['html' => '<p>Измерваме ваши детайли в нашата лаборатория и издаваме протокол. Услугата е подходяща за първи образци, рекламации и сравнение на доставчици, както и преди решение за покупка на собствена машина.</p>']),
        $cta(),
    ], ['sort' => 5, 'related' => [$cmm, $scan]]);

    // ------------------------------------------------------------ начало, за нас, контакти, блог
    page('bg', '', 'page', 'Начало', 'Официален представител на HEXAGON, TESA, Sylvac и TRIMOS за България. Измервателни машини, калибриране, сервиз и обучение на български език.', [
        b('hero', [
            'heading' => 'Измерваме точно. Поддържаме дълго.',
            'text' => 'Предоставяме пълния пакет услуги — от избора на измервателно оборудване до извънгаранционния му сервиз. Официален представител на HEXAGON, TESA, Sylvac и TRIMOS за България.',
            'image' => $img['global'],
            'measure' => 'X 2000 · Y 4000 · Z 1800 mm',
            'ctaLabel' => 'Заявете демонстрация',
            'ctaUrl' => '/kontakti',
        ]),
        b('features', ['heading' => 'Защо да изберете нас', 'items' => [
            ['title' => 'Консултация с инженер', 'text' => 'Нашите инженери ще ви помогнат да изберете правилното решение за конкретните ви метрологични задачи.'],
            ['title' => 'Оторизиран сервиз за страната', 'text' => 'Гаранционен и извънгаранционен сервиз в цялата страна, с резервни части.'],
            ['title' => 'Обучение на български език', 'text' => 'Начално и напреднало обучение, както и опреснителни курсове.'],
            ['title' => 'Проверка и калибриране', 'text' => 'Периодична проверка на точността и калибриране на доставените машини, с калибрационен сертификат.'],
            ['title' => 'Годишен абонамент', 'text' => 'Сервиз, обучение на място, онлайн и телефонна поддръжка за машините и софтуера.'],
            ['title' => 'Детайл-програми и измерване', 'text' => 'Създаваме програми за конкретни детайли и измерваме детайли по поръчка.'],
        ]]),
        b('carousel', ['heading' => 'Новини и продукти', 'source' => 'latest', 'limit' => 10]),
        b('steps', ['heading' => 'Как работим', 'items' => [
            ['title' => 'Каква е задачата', 'text' => 'Изслушваме изискванията ви и предлагаме стандартна или специализирана машина.'],
            ['title' => 'Как ще я решим', 'text' => 'Измерваме ваши образци по зададените критерии и ви даваме протокол с резултатите.'],
            ['title' => 'Доставка и пускане', 'text' => 'Даваме указания за подготовка на помещението, доставяме, инсталираме и калибрираме машината.'],
            ['title' => 'Поддръжка', 'text' => 'Обучаваме операторите и поддържаме машината, за да носи стойност години наред.'],
        ]]),
        b('video', ['heading' => 'Иновация в измерванията', 'provider' => 'youtube', 'videoId' => 'f6kPBycH7Uw', 'caption' => 'Иновация в измерванията — видео от АРК Метрология']),
        b('testimonials', ['heading' => 'Какво казват клиентите ни', 'items' => [
            ['quote' => 'Фирмата изпълни всички свои задължения по договора, инсталира оборудването и проведе обучение на персонала за работа с него. Осигурена е сервизна поддръжка и обезпечение с резервни части.', 'author' => 'Атанас Ангелов', 'company' => 'управител на ФИЛПЛАСТ ООД, с. Ягодово'],
            ['quote' => 'Дългогодишно работим успешно с фирма „АРК Метрология“ ООД – гр. София. Препоръчваме „АРК Метрология“ ООД като сигурен и надежден партньор.', 'author' => 'Нишан Бъздигян', 'company' => 'управител на РАИС ООД, гр. Пазарджик'],
            ['quote' => 'При възникнали проблеми се реагира бързо и качествено. Фирмата упражнява периодичен контрол на машината и консултира персонала своевременно и компетентно.', 'author' => 'Николинка Хинкова', 'company' => 'управител на МЕХАТРОНИКА АД, гр. Габрово'],
        ]]),
        b('logos', ['heading' => 'Партньори', 'images' => $logos]),
        $cta(),
    ], ['key' => 'home', 'metaTitle' => 'АРК Метрология — измервателни машини HEXAGON, калибриране и сервиз']);

    page('bg', 'za-nas', 'page', 'За нас', 'АРК Метрология е основана през 2004 г. и продължава повече от 20-годишна традиция в геометричните измервания за машиностроенето.', [
        b('richtext', ['html' => '<p>АРК Метрология ООД е основана през 2004 г. и продължава традиция от над 20 години в геометричните измервания и метрологията за машиностроенето. Официален представител сме на Hexagon Manufacturing Intelligence и други водещи производители на измервателна техника.</p><p>Личното отношение и качеството вървят ръка за ръка: отговаряме за правилния избор на оборудване, за качеството на продукта и услугата и за надеждността, когато са нужни сервиз или обучение.</p>']),
        b('specs', ['heading' => 'В цифри', 'rows' => [
            ['label' => 'Инсталирани и поддържани машини', 'value' => '230'],
            ['label' => 'Доволни клиенти', 'value' => '350'],
            ['label' => 'Проведени обучения', 'value' => '400'],
        ]]),
        b('steps', ['heading' => 'Пътят на една машина с нас', 'items' => [
            ['title' => 'Оценка и консултация', 'text' => 'Анализираме метрологичните ви изисквания и съветваме за подходящото оборудване.'],
            ['title' => 'Демонстрация', 'text' => 'Показваме машината и при нужда правим тестови измервания на ваш детайл.'],
            ['title' => 'Доставка и инсталация', 'text' => 'Поръчка, доставка и монтаж на оборудването.'],
            ['title' => 'Калибриране', 'text' => 'Калибриране след инсталация по ISO 10360-2 от обучени инженери.'],
            ['title' => 'Обучение', 'text' => 'Обучение на операторите, обикновено начален курс.'],
            ['title' => 'Детайл-програми', 'text' => 'По желание — еднократно или по абонаментен договор.'],
            ['title' => 'Поддръжка', 'text' => 'Софтуерна поддръжка, сервиз и периодично калибриране — ISO изисква калибриране поне веднъж годишно.'],
        ]]),
        $cta(),
    ], ['key' => 'about', 'sort' => 3]);

    page('bg', 'kontakti', 'page', 'Контакти', 'Свържете се с АРК Метрология: ул. Костенски водопад 47, София, тел. +359 876 149 905.', [
        b('contact', ['heading' => 'Пишете ни', 'text' => 'Опишете детайла или задачата — ще ви отговорим в рамките на работния ден. За безплатна демонстрация посочете удобен за вас ден.']),
    ], ['key' => 'contact', 'sort' => 9]);

    page('bg', 'blog', 'page', 'Блог', 'Статии за измервателни машини, калибриране и добри практики в метрологията.', [
        b('listing', ['source' => 'posts']),
    ], ['sort' => 8]);

    page('bg', 'blog/kak-da-izberem-trikoordinatna-mashina', 'post', 'Как да изберем трикоординатна измервателна машина', 'Пет въпроса, които да си зададете преди покупката на трикоординатна машина: обхват, точност, среда, сензори и софтуер.', [
        b('richtext', ['html' => '<p>Изборът на трикоординатна машина (ТИМ) е инвестиция за десетилетие. Ето въпросите, с които започваме всяка консултация.</p><h2>1. Какви са най-големите детайли?</h2><p>Измервателният обхват трябва да побира най-големия детайл заедно с приспособлението и мястото за подход на сондата.</p><h2>2. Каква точност е нужна?</h2><p>Като правило, грешката на машината (MPE по ISO 10360-2) трябва да е поне 5–10 пъти по-малка от най-тесния допуск.</p><h2>3. Къде ще стои машината?</h2><p>В лаборатория с климатизация или до производствената линия — това определя класа на машината и нуждата от температурна компенсация.</p><h2>4. Контактно или безконтактно измерване?</h2><p>Контактните сонди са най-точни за геометрични елементи, а лазерните скенери — за свободни повърхности и пластмасови детайли.</p><h2>5. Кой ще програмира?</h2><p>Обучението и поддръжката на софтуера са толкова важни, колкото и машината.</p><h2>Сравнение накратко</h2><table><thead><tr><th>Решение</th><th>Подходящо за</th><th>Среда</th></tr></thead><tbody><tr><td>Портална ТИМ (HEXAGON Global)</td><td>Висока точност, серийни детайли</td><td>Лаборатория 16–26 °C</td></tr><tr><td>Измервателна ръка (Absolute Arm)</td><td>Едри детайли, измерване на място</td><td>Цех</td></tr><tr><td>Оптична машина (Sylvac Scan)</td><td>Валове и ротационни детайли, бърз контрол</td><td>До машината</td></tr></tbody></table>']),
        $cta(),
    ], ['image' => $img['global'], 'related' => [$cmm, $arm, $scan, $cal], 'date' => '2026-10-01 10:00:00']);

    seed_grant_news();

    // ------------------------------------------------------------ English
    page('en', '', 'page', 'Home', 'Official representative of HEXAGON, TESA, Sylvac and TRIMOS in Bulgaria. Measuring machines, calibration, service and training.', [
        b('hero', [
            'heading' => 'Precise measurement. Long-term support.',
            'text' => 'From choosing the right measuring equipment to post-warranty service — ARC Metrologia is the official HEXAGON, TESA, Sylvac and TRIMOS partner in Bulgaria.',
            'image' => $img['global'],
            'measure' => 'X 2000 · Y 4000 · Z 1800 mm',
            'ctaLabel' => 'Book a demo',
            'ctaUrl' => '/en/contact',
        ]),
        b('features', ['heading' => 'What we do', 'items' => [
            ['title' => 'Consulting', 'text' => 'Our engineers help you choose the right solution for your measuring task.'],
            ['title' => 'Authorised service', 'text' => 'Warranty and post-warranty service across Bulgaria, with spare parts.'],
            ['title' => 'Calibration', 'text' => 'ISO 10360-2 calibration with a calibration certificate.'],
            ['title' => 'Training', 'text' => 'Operator and PC-DMIS training, basic to advanced.'],
        ]]),
        b('cta', ['heading' => 'Free one-hour demo in Sofia', 'text' => 'Bring your part and see the machine measure it.', 'label' => 'Contact us', 'url' => '/en/contact']),
    ], ['key' => 'home', 'metaTitle' => 'ARC Metrologia — HEXAGON measuring machines, calibration and service in Bulgaria']);
    page('en', 'about', 'page', 'About us', 'Founded in 2004, ARC Metrologia continues more than 20 years of tradition in dimensional metrology for mechanical engineering.', [
        b('richtext', ['html' => '<p>ARC Metrologia Ltd was founded in 2004 and continues a tradition of more than 20 years in dimensional measurement and metrology for mechanical engineering. We are the official representative of Hexagon Manufacturing Intelligence and other leading manufacturers of measuring equipment.</p>']),
    ], ['key' => 'about']);
    page('en', 'services/calibration', 'service', 'Calibration of measuring machines', 'ISO 10360-2 calibration of coordinate measuring machines with a calibration certificate.', [
        b('richtext', ['html' => '<p>We calibrate coordinate measuring machines to ISO 10360-2 and issue a calibration certificate — annually, after relocation, or whenever accuracy is in doubt.</p>']),
    ], ['key' => 'calibration']);
    page('en', 'contact', 'page', 'Contact', 'Contact ARC Metrologia: 47 Kostenski Vodopad St, Sofia, phone +359 876 149 905.', [
        b('contact', ['heading' => 'Write to us', 'text' => 'Describe your part or measuring task and we will reply within the working day.']),
    ], ['key' => 'contact']);

    echo "Готово.\n";
}
