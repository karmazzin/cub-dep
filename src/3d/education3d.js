(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const STORAGE_KEY = 'cubdep.education.completed.v1';
  const COUNTRY_KEY = 'cubdep.education.country.v1';
  const CUSTOM_COURSES_KEY = 'cubdep.education.customCourses.v1';
  const GRADE5_EXAM_KEY = 'cubdep.education.grade5Exam.v1';
  const GRADE6_EXAM_KEY = 'cubdep.education.grade6Exam.v1';
  const PASS_COINS = 10;
  const GRADE5_EXAM_PASS_COINS = 35;
  const GRADE6_EXAM_PASS_COINS = 45;
  const LESSON_COUNT = 100;
  const GRADE5_EXAM_SUBJECT_ID = 'grade5_exam';
  const GRADE6_EXAM_SUBJECT_ID = 'grade6_exam';

  const COUNTRIES = [
    { id: 'ru', label: 'Россия' },
    { id: 'us', label: 'США' },
    { id: 'cn', label: 'Китай' },
    { id: 'ua', label: 'Украина' },
    { id: 'by', label: 'Беларусь' },
    { id: 'kz', label: 'Казахстан' },
    { id: 'kg', label: 'Кыргызстан' },
    { id: 'tj', label: 'Таджикистан' },
    { id: 'uz', label: 'Узбекистан' },
    { id: 'mn', label: 'Монголия' },
    { id: 'bg', label: 'Болгария' },
    { id: 'rs', label: 'Сербия' },
    { id: 'mk', label: 'Северная Македония' },
    { id: 'me', label: 'Черногория' },
    { id: 'de', label: 'Германия' },
    { id: 'fr', label: 'Франция' },
    { id: 'gb', label: 'Великобритания' },
    { id: 'in', label: 'Индия' },
    { id: 'jp', label: 'Япония' },
    { id: 'br', label: 'Бразилия' },
  ];

  const SUBJECTS = [
    { id: 'language', label: 'Русский язык' },
    { id: 'math', label: 'Математика' },
    { id: 'world', label: 'Окружающий мир' },
    { id: 'reading', label: 'Чтение' },
    { id: 'informatics', label: 'Информатика' },
    { id: 'foreign', label: 'Иностранный язык' },
    { id: 'creative', label: 'Творчество' },
  ];

  const SUBJECTS_BY_GRADE = {
    1: SUBJECTS,
    2: [
      { id: 'language', label: 'Русский язык' },
      { id: 'literary_reading', label: 'Литературное чтение' },
      { id: 'math', label: 'Математика' },
      { id: 'world', label: 'Окружающий мир' },
      { id: 'informatics', label: 'Информатика' },
      { id: 'foreign', label: 'Иностранный язык' },
      { id: 'creative', label: 'Творчество' },
    ],
    3: [
      { id: 'language', label: 'Русский язык' },
      { id: 'literary_reading', label: 'Литературное чтение' },
      { id: 'math', label: 'Математика' },
      { id: 'world', label: 'Окружающий мир' },
      { id: 'informatics', label: 'Информатика' },
      { id: 'foreign', label: 'Иностранный язык' },
      { id: 'creative', label: 'Творчество' },
    ],
    4: [
      { id: 'language', label: 'Русский язык' },
      { id: 'literary_reading', label: 'Литературное чтение' },
      { id: 'math', label: 'Математика' },
      { id: 'world', label: 'Окружающий мир' },
      { id: 'informatics', label: 'Информатика' },
      { id: 'foreign', label: 'Иностранный язык' },
      { id: 'english_reading', label: 'Англоязычное чтение' },
      { id: 'creative', label: 'Творчество' },
    ],
    5: [
      { id: 'language', label: 'Русский язык' },
      { id: 'literature', label: 'Литература' },
      { id: 'math', label: 'Математика' },
      { id: 'history', label: 'История' },
      { id: 'geography', label: 'География' },
      { id: 'biology', label: 'Биология' },
      { id: 'informatics', label: 'Информатика' },
      { id: 'foreign', label: 'Иностранный язык' },
      { id: 'english_reading', label: 'Англоязычное чтение' },
      { id: 'creative', label: 'Творчество' },
    ],
    6: [
      { id: 'language', label: 'Русский язык' },
      { id: 'literature', label: 'Литература' },
      { id: 'math', label: 'Математика' },
      { id: 'history', label: 'История' },
      { id: 'geography', label: 'География' },
      { id: 'biology', label: 'Биология' },
      { id: 'informatics', label: 'Информатика' },
      { id: 'foreign', label: 'Иностранный язык' },
      { id: 'english_reading', label: 'Англоязычное чтение' },
      { id: 'creative', label: 'Творчество' },
    ],
    7: [
      { id: 'language', label: 'Русский язык' },
      { id: 'literature', label: 'Литература' },
      { id: 'algebra', label: 'Алгебра' },
      { id: 'geometry', label: 'Геометрия' },
      { id: 'history', label: 'История' },
      { id: 'geography', label: 'География' },
      { id: 'biology', label: 'Биология' },
      { id: 'physics', label: 'Физика' },
      { id: 'informatics', label: 'Информатика' },
      { id: 'foreign', label: 'Иностранный язык' },
      { id: 'english_reading', label: 'Англоязычное чтение' },
      { id: 'creative', label: 'Творчество' },
    ],
  };

  const LETTER_BY_CHAR = {
    А: BLOCK.LETTER_A,
    Б: BLOCK.LETTER_B,
    В: BLOCK.LETTER_V,
    Г: BLOCK.LETTER_G,
    Д: BLOCK.LETTER_D,
    Е: BLOCK.LETTER_E,
    Ё: BLOCK.LETTER_YO,
    Ж: BLOCK.LETTER_ZH,
    З: BLOCK.LETTER_Z,
    И: BLOCK.LETTER_I,
    Й: BLOCK.LETTER_SHORT_I,
    К: BLOCK.LETTER_K,
    Л: BLOCK.LETTER_L,
    М: BLOCK.LETTER_M,
    Н: BLOCK.LETTER_N,
    О: BLOCK.LETTER_O,
    П: BLOCK.LETTER_P,
    Р: BLOCK.LETTER_R,
    С: BLOCK.LETTER_S,
    Т: BLOCK.LETTER_T,
    У: BLOCK.LETTER_U,
    Ф: BLOCK.LETTER_F,
    Х: BLOCK.LETTER_H,
    Ц: BLOCK.LETTER_TS,
    Ч: BLOCK.LETTER_CH,
    Ш: BLOCK.LETTER_SH,
    Щ: BLOCK.LETTER_SHCH,
    Ъ: BLOCK.LETTER_HARD_SIGN,
    Ы: BLOCK.LETTER_Y,
    Ь: BLOCK.LETTER_SOFT_SIGN,
    Э: BLOCK.LETTER_EH,
    Ю: BLOCK.LETTER_YU,
    Я: BLOCK.LETTER_YA,
    A: BLOCK.LETTER_EN_A,
    B: BLOCK.LETTER_EN_B,
    C: BLOCK.LETTER_EN_C,
    D: BLOCK.LETTER_EN_D,
    E: BLOCK.LETTER_EN_E,
    F: BLOCK.LETTER_EN_F,
    G: BLOCK.LETTER_EN_G,
    H: BLOCK.LETTER_EN_H,
    I: BLOCK.LETTER_EN_I,
    J: BLOCK.LETTER_EN_J,
    K: BLOCK.LETTER_EN_K,
    L: BLOCK.LETTER_EN_L,
    M: BLOCK.LETTER_EN_M,
    N: BLOCK.LETTER_EN_N,
    O: BLOCK.LETTER_EN_O,
    P: BLOCK.LETTER_EN_P,
    Q: BLOCK.LETTER_EN_Q,
    R: BLOCK.LETTER_EN_R,
    S: BLOCK.LETTER_EN_S,
    T: BLOCK.LETTER_EN_T,
    U: BLOCK.LETTER_EN_U,
    V: BLOCK.LETTER_EN_V,
    W: BLOCK.LETTER_EN_W,
    X: BLOCK.LETTER_EN_X,
    Y: BLOCK.LETTER_EN_Y,
    Z: BLOCK.LETTER_EN_Z,
  };

  const FOREIGN_WORDS = [
    ['cat', 'кот'], ['dog', 'собака'], ['house', 'дом'], ['forest', 'лес'], ['summer', 'лето'],
    ['stone', 'камень'], ['water', 'вода'], ['sand', 'песок'], ['leaf', 'лист'], ['table', 'стол'],
    ['garden', 'сад'], ['food', 'еда'], ['bridge', 'мост'], ['school', 'школа'], ['book', 'книга'],
    ['sun', 'солнце'], ['moon', 'луна'], ['star', 'звезда'], ['river', 'река'], ['mountain', 'гора'],
    ['tree', 'дерево'], ['flower', 'цветок'], ['road', 'дорога'], ['friend', 'друг'], ['family', 'семья'],
    ['city', 'город'], ['village', 'село'], ['field', 'поле'], ['bird', 'птица'], ['fish', 'рыба'],
    ['horse', 'конь'], ['milk', 'молоко'], ['bread', 'хлеб'], ['apple', 'яблоко'], ['window', 'окно'],
    ['door', 'дверь'], ['room', 'комната'], ['game', 'игра'], ['song', 'песня'], ['hand', 'рука'],
    ['leg', 'нога'], ['head', 'голова'], ['eye', 'глаз'], ['ear', 'ухо'], ['day', 'день'],
    ['night', 'ночь'], ['morning', 'утро'], ['evening', 'вечер'], ['snow', 'снег'], ['rain', 'дождь'],
    ['wind', 'ветер'], ['fire', 'огонь'], ['earth', 'земля'], ['air', 'воздух'], ['child', 'ребенок'],
    ['teacher', 'учитель'], ['lesson', 'урок'], ['letter', 'буква'], ['word', 'слово'], ['story', 'сказка'],
  ].map(([en, ru]) => ({ en, ru }));

  const TASKS = {
    language: [
      { type: 'place', block: BLOCK.LETTER_L, count: 1, text: 'Поставь блок-букву Л: начинаем слово "лес".' },
      { type: 'place', block: BLOCK.LETTER_E, count: 1, text: 'Поставь блок-букву Е: вторая буква слова "лес".' },
      { type: 'place', block: BLOCK.LETTER_S, count: 1, text: 'Поставь блок-букву С: закончи слово "лес".' },
      { type: 'place', block: BLOCK.LETTER_D, count: 1, text: 'Поставь блок-букву Д: начинаем слово "дом".' },
      { type: 'place', block: BLOCK.LETTER_O, count: 1, text: 'Поставь блок-букву О: середина слова "дом".' },
      { type: 'place', block: BLOCK.LETTER_M, count: 1, text: 'Поставь блок-букву М: закончи слово "дом".' },
      { type: 'place', block: BLOCK.LETTER_A, count: 1, text: 'Поставь блок-букву А: первая буква слова "арбуз".' },
      { type: 'place', block: BLOCK.LETTER_K, count: 1, text: 'Поставь блок-букву К: первая буква слова "кот".' },
      { type: 'place', block: BLOCK.LETTER_T, count: 1, text: 'Поставь блок-букву Т: последняя буква слова "кот".' },
      { type: 'place', block: BLOCK.LETTER_YA, count: 1, text: 'Поставь блок-букву Я: отдельное короткое слово.' },
    ],
    math: [
      { type: 'place', block: BLOCK.DIRT, count: 3, text: 'Поставь 3 блока земли: решаем счет до трех.' },
      { type: 'mine', block: BLOCK.STONE, count: 2, text: 'Добыть 2 блока камня: это число 2.' },
      { type: 'place', block: BLOCK.STONE, count: 4, text: 'Построй башню или ряд из 4 камней.' },
      { type: 'place', block: BLOCK.PLANK, count: 5, text: 'Поставь 5 досок: считаем до пяти.' },
      { type: 'mine', block: BLOCK.DIRT, count: 4, text: 'Добыть 4 блока земли: число 4.' },
      { type: 'place', block: BLOCK.SAND, count: 2, text: 'Поставь 2 блока песка: пара.' },
      { type: 'mine', block: BLOCK.WOOD, count: 3, text: 'Добыть 3 блока дерева: 1 + 2 = 3.' },
      { type: 'place', block: BLOCK.WOOD, count: 6, text: 'Поставь 6 блоков дерева: считаем до шести.' },
      { type: 'mine', block: BLOCK.SAND, count: 1, text: 'Добыть 1 блок песка: один предмет.' },
      { type: 'place', block: BLOCK.DIRT, count: 7, text: 'Поставь 7 блоков земли: большой счет.' },
    ],
    world: [
      { type: 'near', block: BLOCK.WATER, count: 1, text: 'Найди воду и подойди к ней.' },
      { type: 'near', block: BLOCK.WOOD, count: 1, text: 'Найди дерево и подойди к стволу.' },
      { type: 'mine', block: BLOCK.SAND, count: 1, text: 'Добыть песок: он встречается у воды и в пустыне.' },
      { type: 'near', block: BLOCK.LEAF, count: 1, text: 'Подойди к листьям дерева.' },
      { type: 'mine', block: BLOCK.WOOD, count: 1, text: 'Добыть дерево: из него делают доски.' },
      { type: 'near', block: BLOCK.STONE, count: 1, text: 'Найди камень и подойди к нему.' },
      { type: 'mine', block: BLOCK.DIRT, count: 2, text: 'Добыть 2 блока земли: это слой почвы.' },
      { type: 'place', block: BLOCK.WATER, count: 1, text: 'Поставь воду и посмотри, как она течет.' },
      { type: 'place', block: BLOCK.SAND, count: 3, text: 'Поставь 3 блока песка: сделай берег.' },
      { type: 'near', block: BLOCK.GRASS, count: 1, text: 'Найди траву и подойди к зеленому блоку.' },
    ],
    reading: [
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.WOOD], text: 'Текст: у тропы лежит земля, рядом стоит дерево. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.SAND], text: 'Текст: на берегу видны камень и песок. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.LEAF], text: 'Текст: мастер взял доски, а над ним шумели листья. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.WATER, BLOCK.SAND], text: 'Текст: вода коснулась песка у края озера. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.PLANK, BLOCK.STONE], text: 'Текст: дерево стало досками, а рядом лежал камень. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.LEAF, BLOCK.WATER], text: 'Текст: земля держит листья, а вода помогает им расти. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.STONE, BLOCK.DIRT], text: 'Текст: песок, камень и земля встретились на дороге. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.WOOD, BLOCK.LEAF], text: 'Текст: из дерева сделали доски, но листья остались зелеными. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.WATER, BLOCK.STONE, BLOCK.LEAF], text: 'Текст: вода текла между камнями, над ней висели листья. Поставь все блоки, которые ты прочитал в тексте.' },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.SAND, BLOCK.WOOD, BLOCK.PLANK], text: 'Текст: земля, песок, дерево и доски нужны для маленькой стройки. Поставь все блоки, которые ты прочитал в тексте.' },
    ],
    logic: [
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.STONE], text: 'Правило: мягкий блок, потом твердый блок. Поставь землю и камень.' },
      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.LEAF], text: 'Правило: ствол держит крону. Поставь дерево и листья.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.WATER], text: 'Правило: берег рядом с водой. Поставь песок и воду.' },
      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.PLANK], text: 'Правило: материал и то, что из него сделали. Поставь дерево и доски.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.DIRT, BLOCK.STONE], text: 'Узор: камень, земля, камень. Поставь такие блоки.' },
      { type: 'placeSet', blocks: [BLOCK.LEAF, BLOCK.WOOD, BLOCK.LEAF], text: 'Узор: листья, дерево, листья. Поставь такие блоки.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.DIRT, BLOCK.WATER], text: 'Найди связь: песок, земля, вода. Поставь эти блоки.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.STONE, BLOCK.PLANK], text: 'Узор: доски, камень, доски. Поставь такие блоки.' },
      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.SAND, BLOCK.LEAF], text: 'Три разных материала: дерево, песок, листья. Поставь каждый.' },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.WOOD, BLOCK.STONE, BLOCK.WATER], text: 'Итоговая цепочка: земля, дерево, камень, вода. Поставь эти блоки.' },
    ],
    creative: [
      { type: 'place', block: BLOCK.LEAF, count: 4, text: 'Укрась постройку 4 блоками листьев.' },
      { type: 'place', block: BLOCK.PLANK, count: 6, text: 'Сделай деревянный пол из 6 досок.' },
      { type: 'place', block: BLOCK.SAND, count: 4, text: 'Сделай песочную рамку из 4 блоков.' },
      { type: 'place', block: BLOCK.WOOD, count: 3, text: 'Поставь 3 деревянные опоры для домика.' },
      { type: 'place', block: BLOCK.WATER, count: 1, text: 'Добавь воду как маленький пруд.' },
      { type: 'place', block: BLOCK.STONE, count: 5, text: 'Сделай каменную площадку для скульптуры.' },
      { type: 'place', block: BLOCK.DIRT, count: 3, text: 'Сделай основу клумбы из 3 блоков земли.' },
      { type: 'place', block: BLOCK.LEAF, count: 6, text: 'Сделай зеленую крону или куст из 6 листьев.' },
      { type: 'place', block: BLOCK.PLANK, count: 2, text: 'Добавь 2 доски как маленькую скамейку.' },
      { type: 'place', block: BLOCK.SAND, count: 5, text: 'Сделай свободный песочный рисунок из 5 блоков.' },
    ],
  };

  const LANGUAGE_HOTBAR = [
    BLOCK.LETTER_A,
    BLOCK.LETTER_D,
    BLOCK.LETTER_E,
    BLOCK.LETTER_K,
    BLOCK.LETTER_L,
    BLOCK.LETTER_M,
    BLOCK.LETTER_O,
    BLOCK.LETTER_S,
    BLOCK.LETTER_T,
    BLOCK.LETTER_YA,
  ];

  const ENGLISH_HOTBAR = [
    BLOCK.LETTER_EN_A,
    BLOCK.LETTER_EN_B,
    BLOCK.LETTER_EN_C,
    BLOCK.LETTER_EN_D,
    BLOCK.LETTER_EN_E,
    BLOCK.LETTER_EN_F,
    BLOCK.LETTER_EN_G,
    BLOCK.LETTER_EN_H,
    BLOCK.LETTER_EN_I,
    BLOCK.LETTER_EN_J,
    BLOCK.LETTER_EN_K,
    BLOCK.LETTER_EN_L,
    BLOCK.LETTER_EN_M,
    BLOCK.LETTER_EN_N,
    BLOCK.LETTER_EN_O,
    BLOCK.LETTER_EN_P,
    BLOCK.LETTER_EN_Q,
    BLOCK.LETTER_EN_R,
    BLOCK.LETTER_EN_S,
    BLOCK.LETTER_EN_T,
    BLOCK.LETTER_EN_U,
    BLOCK.LETTER_EN_V,
    BLOCK.LETTER_EN_W,
    BLOCK.LETTER_EN_X,
    BLOCK.LETTER_EN_Y,
    BLOCK.LETTER_EN_Z,
  ];

  const ENGLISH_READING_WORDS = [
    { en: 'dirt', ru: 'земля', block: BLOCK.DIRT },
    { en: 'stone', ru: 'камень', block: BLOCK.STONE },
    { en: 'wood', ru: 'дерево', block: BLOCK.WOOD },
    { en: 'plank', ru: 'доски', block: BLOCK.PLANK },
    { en: 'water', ru: 'вода', block: BLOCK.WATER },
    { en: 'sand', ru: 'песок', block: BLOCK.SAND },
    { en: 'leaf', ru: 'листья', block: BLOCK.LEAF },
    { en: 'lava', ru: 'лава', block: BLOCK.LAVA },
    { en: 'small dynamite', ru: 'маленький динамит', block: BLOCK.DYNAMITE_SMALL },
    { en: 'medium dynamite', ru: 'средний динамит', block: BLOCK.DYNAMITE_MEDIUM },
    { en: 'large dynamite', ru: 'большой динамит', block: BLOCK.DYNAMITE_LARGE },
    { en: 'huge dynamite', ru: 'огромный динамит', block: BLOCK.DYNAMITE_HUGE },
    { en: 'mega dynamite', ru: 'мега-динамит', block: BLOCK.DYNAMITE_MEGA_HUGE },
    { en: 'power dynamite', ru: 'сильный динамит', block: BLOCK.DYNAMITE_POWER_75 },
    { en: 'max dynamite', ru: 'самый сильный динамит', block: BLOCK.DYNAMITE_POWER_100 },
    { en: 'remote', ru: 'пульт от ТНТ', block: BLOCK.TNT_REMOTE },
    { en: 'calculator', ru: 'калькулятор', block: BLOCK.CALCULATOR },
    { en: 'portal stone', ru: 'камень странного портала', block: BLOCK.STRANGE_PORTAL_STONE },
    { en: 'portal core', ru: 'ядро странного портала', block: BLOCK.STRANGE_PORTAL_CORE },
    { en: 'portal rune', ru: 'руна странного портала', block: BLOCK.STRANGE_PORTAL_RUNE },
  ];
  const ENGLISH_READING_HOTBAR = uniqueBlocks(ENGLISH_READING_WORDS.map((item) => item.block));

  const CREATIVE_PROJECTS = [
    'каменную скульптуру',
    'маленький домик',
    'песочный замок',
    'деревянную башню',
    'сад с прудом',
    'мостик через ручей',
    'зеленую беседку',
    'каменный фонтан',
    'площадку для игры',
    'домик у озера',
    'лесную арку',
    'песочный двор',
    'маяк из камня',
    'деревянную сцену',
    'клумбу с оградой',
    'домик строителя',
    'смотровую площадку',
    'каминную стену',
    'тихий причал',
    'лесной трон',
    'маленькую крепость',
    'парк с дорожкой',
    'каменные ворота',
    'домик рыбака',
    'песочную арену',
    'деревянный навес',
    'зеленый лабиринт',
    'колодец во дворе',
    'камень памяти',
    'мастерскую художника',
    'лесную сцену',
    'береговую башню',
    'домик с садом',
    'малый храм',
    'песочную пирамиду',
    'домик путешественника',
    'каменный круг',
    'деревянную лодку',
    'зеленую стену',
    'площадь с фонтаном',
    'пост охраны',
    'садовый мост',
    'домик на холме',
    'каменную лестницу',
    'песочный узор',
    'лесную хижину',
    'пруд с берегом',
    'деревянный рынок',
    'скульптуру дерева',
    'двор с лавками',
    'мини-замок',
    'каменный обелиск',
    'уютную террасу',
    'песочный корабль',
    'домик ученого',
    'зеленый купол',
    'каменную сцену',
    'деревянный причал',
    'садовую башню',
    'малую площадь',
    'ворота сада',
    'домик мастера',
    'каменный мост',
    'песочный дворец',
    'лесную башенку',
    'дом у дерева',
    'каменную статую',
    'прудовый сад',
    'деревянную галерею',
    'песочную стену',
    'малую библиотеку',
    'зеленую арку',
    'каменный двор',
    'домик смотрителя',
    'сцену праздника',
    'песочный маяк',
    'лесной дворик',
    'каменный пьедестал',
    'деревянную крепость',
    'садовый павильон',
    'домик у моста',
    'площадку скульптора',
    'песочный сад',
    'каменную часовню',
    'зеленую беседку у воды',
    'деревянный амбар',
    'малую пристань',
    'площадь мастеров',
    'лесной портал',
    'каменный сад',
    'домик с башней',
    'песочную галерею',
    'деревянный двор',
    'зеленый театр',
    'каменную набережную',
    'домик картографа',
    'сад с колоннами',
    'песочную крепость',
    'деревянную ратушу',
    'большую скульптуру',
  ];

  function getSubjects(grade = 1) {
    return SUBJECTS_BY_GRADE[Number(grade) || 1] || SUBJECTS_BY_GRADE[1];
  }

  function subjectById(id, grade = 1) {
    const allSubjects = Object.values(SUBJECTS_BY_GRADE).flat();
    return getSubjects(grade).find((subject) => subject.id === id)
      || allSubjects.find((subject) => subject.id === id)
      || SUBJECTS[0];
  }

  function countryById(id) {
    return COUNTRIES.find((country) => country.id === id) || COUNTRIES[0];
  }

  function clampLesson(lesson) {
    const value = Number(lesson) || 1;
    return Math.max(1, Math.min(LESSON_COUNT, value | 0));
  }

  function creativeProjectForLesson(lesson, grade = 1) {
    const safeLesson = Number(grade) === 2 ? Math.min(LESSON_COUNT, clampLesson(lesson) + 15) : clampLesson(lesson);
    return CREATIVE_PROJECTS[(safeLesson - 1) % CREATIVE_PROJECTS.length];
  }

  function getLessonSummary(subjectId, grade, lesson) {
    const subject = subjectById(subjectId, grade).id;
    if (subject === 'english_reading') {
      const safeLesson = clampLesson(lesson);
      const setCount = Math.ceil(ENGLISH_READING_WORDS.length / 10);
      if (safeLesson <= setCount * 2) {
        return safeLesson % 2 === 1 ? 'Новые английские слова-блоки' : 'Текст с изученными блоками';
      }
      return 'Текст с повторением изученных блоков';
    }
    if (subject !== 'creative') return '';
    return `Постройка: ${creativeProjectForLesson(lesson, grade)}`;
  }

  function completedKey(countryId, grade, subjectId, lesson) {
    return `${countryId || 'ru'}:${grade || 1}:${subjectId || 'language'}:${clampLesson(lesson)}`;
  }

  function grade5ExamKey(countryId) {
    return `${countryId || 'ru'}:grade5`;
  }

  function grade6ExamKey(countryId) {
    return `${countryId || 'ru'}:grade6`;
  }

  function readCompletedMap() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : '';
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      return {};
    }
  }

  function readGrade5ExamMap() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(GRADE5_EXAM_KEY) : '';
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      return {};
    }
  }

  function writeGrade5ExamMap(map) {
    try {
      if (window.localStorage) window.localStorage.setItem(GRADE5_EXAM_KEY, JSON.stringify(map));
    } catch (error) {
      // Exam progress is still kept in the active world if localStorage is unavailable.
    }
  }

  function readGrade6ExamMap() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(GRADE6_EXAM_KEY) : '';
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      return {};
    }
  }

  function writeGrade6ExamMap(map) {
    try {
      if (window.localStorage) window.localStorage.setItem(GRADE6_EXAM_KEY, JSON.stringify(map));
    } catch (error) {
      // Exam progress is still kept in the active world if localStorage is unavailable.
    }
  }

  function readCustomCourses() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(CUSTOM_COURSES_KEY) : '';
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.map(normalizeCustomCourse).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function writeCustomCourses(courses) {
    try {
      if (window.localStorage) window.localStorage.setItem(CUSTOM_COURSES_KEY, JSON.stringify(courses));
    } catch (error) {
      // Ignore storage failures; custom courses are local convenience data.
    }
  }

  function normalizeCustomCourse(course) {
    if (!course || typeof course !== 'object') return null;
    const title = String(course.title || '').trim();
    if (!title) return null;
    return {
      id: String(course.id || `custom-${Date.now().toString(36)}`),
      countryId: countryById(course.countryId).id,
      grade: Number(course.grade) || 1,
      title,
      createdAt: Number(course.createdAt) || Date.now(),
      updatedAt: Number(course.updatedAt) || Date.now(),
      lessons: Array.isArray(course.lessons) ? course.lessons.map(normalizeCustomLesson).filter(Boolean) : [],
    };
  }

  function normalizeCustomLesson(lesson) {
    if (!lesson || typeof lesson !== 'object') return null;
    return {
      id: String(lesson.id || `lesson-${Date.now().toString(36)}`),
      title: String(lesson.title || 'Урок').trim() || 'Урок',
      seed: String(lesson.seed || '').trim(),
      mode: normalizeCustomLessonMode(lesson.mode),
      spawnMode: normalizeCustomLessonSpawnMode(lesson.spawnMode),
      ready: !!lesson.ready,
      hasMap: !!lesson.hasMap,
      mapWorldId: lesson.mapWorldId ? String(lesson.mapWorldId) : '',
      code: normalizeCustomLessonCode(lesson.code),
      createdAt: Number(lesson.createdAt) || Date.now(),
      updatedAt: Number(lesson.updatedAt) || Date.now(),
    };
  }

  function normalizeCustomLessonCode(code) {
    const source = code && typeof code === 'object' ? code : {};
    const actions = Array.isArray(source.actions) ? source.actions : [];
    const normalized = actions.map(normalizeCustomLessonCodeAction).filter(Boolean);
    if (normalized.length) return { actions: normalized };
    return {
      actions: [
        {
          number: 1,
          start: [],
          complete: [],
        },
      ],
    };
  }

  function normalizeCustomLessonCodeAction(action, index = 0) {
    if (!action || typeof action !== 'object') return null;
    const number = Math.max(1, Number(action.number) || index + 1);
    return {
      number,
      start: Array.isArray(action.start) ? action.start.map(normalizeCustomLessonStartBlock).filter(Boolean) : [],
      complete: Array.isArray(action.complete) ? action.complete.map(normalizeCustomLessonCompleteBlock).filter(Boolean) : [],
    };
  }

  function normalizeCustomLessonStartBlock(block) {
    if (!block || typeof block !== 'object') return null;
    const type = String(block.type || '');
    if (type === 'give') {
      const itemId = block.itemId !== null && block.itemId !== undefined && block.itemId !== '' && Number.isFinite(Number(block.itemId))
        ? Number(block.itemId)
        : null;
      return {
        type,
        itemId,
        item: String(block.item || '').trim(),
        slot: Math.max(1, Number(block.slot) || 1),
      };
    }
    if (type === 'teleport') {
      return {
        type,
        coords: String(block.coords || '').trim(),
      };
    }
    if (type === 'say') {
      return {
        type,
        text: String(block.text || '').trim(),
      };
    }
    if (type === 'thumbnail') {
      return {
        type,
        name: String(block.name || '').trim(),
        dataUrl: String(block.dataUrl || ''),
      };
    }
    return null;
  }

  function normalizeCustomLessonCompleteBlock(block) {
    if (!block || typeof block !== 'object') return null;
    const type = String(block.type || '');
    if (type === 'place' || type === 'mine') {
      const blockId = block.blockId !== null && block.blockId !== undefined && block.blockId !== '' && Number.isFinite(Number(block.blockId))
        ? Number(block.blockId)
        : null;
      return {
        type,
        blockId,
        block: String(block.block || '').trim(),
      };
    }
    if (type === 'biome') {
      return {
        type,
        biome: String(block.biome || '').trim(),
      };
    }
    return null;
  }

  function normalizeCustomLessonMode(mode) {
    if (mode === 'adventure' || mode === 'creative_adventure') return mode;
    return 'survival';
  }

  function normalizeCustomLessonSpawnMode(mode) {
    return mode === 'world_spawn' ? 'world_spawn' : 'editor_position';
  }

  function customCoursesFor(countryId, grade) {
    const safeCountry = countryById(countryId).id;
    const safeGrade = Number(grade) || 1;
    return readCustomCourses().filter((course) => course.countryId === safeCountry && course.grade === safeGrade);
  }

  function customCourseById(courseId) {
    return readCustomCourses().find((course) => course.id === courseId) || null;
  }

  function saveCustomCourse(course) {
    const normalized = normalizeCustomCourse(course);
    if (!normalized) return null;
    const courses = readCustomCourses();
    const index = courses.findIndex((item) => item.id === normalized.id);
    normalized.updatedAt = Date.now();
    if (index >= 0) courses[index] = normalized;
    else courses.push(normalized);
    writeCustomCourses(courses);
    return normalized;
  }

  function createCustomCourse(countryId, grade, title) {
    return saveCustomCourse({
      id: `course-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      countryId,
      grade,
      title,
      lessons: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  function createCustomLesson(courseId, seed) {
    const course = customCourseById(courseId);
    if (!course) return null;
    const nextNumber = course.lessons.length + 1;
    const lesson = normalizeCustomLesson({
      id: `lesson-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: `Урок ${nextNumber}`,
      seed: String(seed || '').trim(),
      mode: 'survival',
      hasMap: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    course.lessons.push(lesson);
    saveCustomCourse(course);
    return lesson;
  }

  function customLessonById(courseId, lessonId) {
    const course = customCourseById(courseId);
    if (!course) return null;
    return course.lessons.find((lesson) => lesson.id === lessonId) || null;
  }

  function saveCustomLesson(courseId, lesson) {
    const course = customCourseById(courseId);
    const normalized = normalizeCustomLesson(lesson);
    if (!course || !normalized) return null;
    const index = course.lessons.findIndex((item) => item.id === normalized.id);
    normalized.updatedAt = Date.now();
    if (index >= 0) course.lessons[index] = normalized;
    else course.lessons.push(normalized);
    saveCustomCourse(course);
    return normalized;
  }

  function getSavedCountryId() {
    try {
      const id = window.localStorage ? window.localStorage.getItem(COUNTRY_KEY) : '';
      return id ? countryById(id).id : '';
    } catch (error) {
      return '';
    }
  }

  function saveCountryId(countryId) {
    const country = countryById(countryId);
    try {
      if (window.localStorage) window.localStorage.setItem(COUNTRY_KEY, country.id);
    } catch (error) {
      // Country selection can still be used for the current navigation.
    }
    return country.id;
  }

  function writeCompletedMap(map) {
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
      // Progress is still kept in the active world if localStorage is unavailable.
    }
  }

  function isCompleted(countryId, grade, subjectId, lesson) {
    return !!readCompletedMap()[completedKey(countryId, grade, subjectId, lesson)];
  }

  function markCompleted(countryId, grade, subjectId, lesson) {
    const map = readCompletedMap();
    map[completedKey(countryId, grade, subjectId, lesson)] = true;
    writeCompletedMap(map);
  }

  function isGrade5ExamCompleted(countryId) {
    return !!readGrade5ExamMap()[grade5ExamKey(countryId)];
  }

  function markGrade5ExamCompleted(countryId) {
    const map = readGrade5ExamMap();
    map[grade5ExamKey(countryId)] = true;
    writeGrade5ExamMap(map);
  }

  function isGrade6ExamCompleted(countryId) {
    return !!readGrade6ExamMap()[grade6ExamKey(countryId)];
  }

  function markGrade6ExamCompleted(countryId) {
    const map = readGrade6ExamMap();
    map[grade6ExamKey(countryId)] = true;
    writeGrade6ExamMap(map);
  }

  function completedLessonCount(countryId, grade, subjectId) {
    const map = readCompletedMap();
    let count = 0;
    for (let lesson = 1; lesson <= LESSON_COUNT; lesson += 1) {
      if (map[completedKey(countryId, grade, subjectId, lesson)]) count += 1;
    }
    return count;
  }

  function isSubjectCompleted(countryId, grade, subjectId) {
    return completedLessonCount(countryId, grade, subjectId) >= LESSON_COUNT;
  }

  function createEducationMeta(countryId, grade, subjectId, lesson = 1) {
    const subject = subjectById(subjectId, grade);
    const country = countryById(countryId);
    return {
      countryId: country.id,
      countryLabel: country.label,
      grade: grade || 1,
      subjectId: subject.id,
      subjectLabel: subject.label,
      lesson: clampLesson(lesson),
      coins: 0,
      taskIndex: 0,
      taskProgress: 0,
      taskProgressMap: {},
      completed: false,
    };
  }

  function createGrade5ExamMeta(countryId) {
    const country = countryById(countryId);
    return {
      countryId: country.id,
      countryLabel: country.label,
      grade: 5,
      subjectId: GRADE5_EXAM_SUBJECT_ID,
      subjectLabel: 'Экзамен перед 5 классом',
      lesson: 1,
      coins: 0,
      passCoins: GRADE5_EXAM_PASS_COINS,
      taskIndex: 0,
      taskProgress: 0,
      taskProgressMap: {},
      completed: false,
      exam: 'grade5',
    };
  }

  function createGrade6ExamMeta(countryId) {
    const country = countryById(countryId);
    return {
      countryId: country.id,
      countryLabel: country.label,
      grade: 6,
      subjectId: GRADE6_EXAM_SUBJECT_ID,
      subjectLabel: 'Экзамен перед 6 классом',
      lesson: 1,
      coins: 0,
      passCoins: GRADE6_EXAM_PASS_COINS,
      taskIndex: 0,
      taskProgress: 0,
      taskProgressMap: {},
      completed: false,
      exam: 'grade6',
    };
  }

  function ensureEducation(state) {
    if (!state || !state.worldMeta || state.worldMeta.mode !== 'education') return null;
    if (!state.worldMeta.education) state.worldMeta.education = createEducationMeta('ru', 1, 'language');
    const education = state.worldMeta.education;
    if (education.exam === 'grade5' || education.subjectId === GRADE5_EXAM_SUBJECT_ID) {
      const country = countryById(education.countryId);
      education.countryId = country.id;
      education.countryLabel = country.label;
      education.grade = 5;
      education.subjectId = GRADE5_EXAM_SUBJECT_ID;
      education.subjectLabel = 'Экзамен перед 5 классом';
      education.lesson = 1;
      education.passCoins = GRADE5_EXAM_PASS_COINS;
      education.coins = Math.max(0, Math.min(GRADE5_EXAM_PASS_COINS, education.coins | 0));
      education.taskIndex = Math.max(0, education.taskIndex | 0);
      education.taskProgress = Math.max(0, education.taskProgress | 0);
      if (!education.taskProgressMap || typeof education.taskProgressMap !== 'object') education.taskProgressMap = {};
      education.completed = !!education.completed || isGrade5ExamCompleted(country.id);
      if (education.completed) education.coins = GRADE5_EXAM_PASS_COINS;
      education.exam = 'grade5';
      return education;
    }
    if (education.exam === 'grade6' || education.subjectId === GRADE6_EXAM_SUBJECT_ID) {
      const country = countryById(education.countryId);
      education.countryId = country.id;
      education.countryLabel = country.label;
      education.grade = 6;
      education.subjectId = GRADE6_EXAM_SUBJECT_ID;
      education.subjectLabel = 'Экзамен перед 6 классом';
      education.lesson = 1;
      education.passCoins = GRADE6_EXAM_PASS_COINS;
      education.coins = Math.max(0, Math.min(GRADE6_EXAM_PASS_COINS, education.coins | 0));
      education.taskIndex = Math.max(0, education.taskIndex | 0);
      education.taskProgress = Math.max(0, education.taskProgress | 0);
      if (!education.taskProgressMap || typeof education.taskProgressMap !== 'object') education.taskProgressMap = {};
      education.completed = !!education.completed || isGrade6ExamCompleted(country.id);
      if (education.completed) education.coins = GRADE6_EXAM_PASS_COINS;
      education.exam = 'grade6';
      return education;
    }
    const subject = subjectById(education.subjectId, education.grade);
    const country = countryById(education.countryId);
    education.countryId = country.id;
    education.countryLabel = country.label;
    education.grade = education.grade || 1;
    education.subjectId = subject.id;
    education.subjectLabel = subject.label;
    education.lesson = clampLesson(education.lesson);
    education.passCoins = PASS_COINS;
    education.coins = Math.max(0, Math.min(PASS_COINS, education.coins | 0));
    education.taskIndex = Math.max(0, education.taskIndex | 0);
    education.taskProgress = Math.max(0, education.taskProgress | 0);
    if (!education.taskProgressMap || typeof education.taskProgressMap !== 'object') education.taskProgressMap = {};
    education.completed = !!education.completed;
    if (education.completed) education.coins = PASS_COINS;
    return education;
  }

  function currentTask(education) {
    if (!education) return null;
    const tasks = education.exam === 'grade5'
      ? getGrade5ExamTasks()
      : (education.exam === 'grade6' ? getGrade6ExamTasks() : getLessonTasks(education.subjectId, education.lesson, education.grade));
    return tasks[education.taskIndex] || null;
  }

  function blockName(blockId) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    return (labels && labels[blockId]) || 'блок';
  }

  function stagePositions(stage, count) {
    const positions = [];
    const addGrid = (xs, zs, y = 0) => {
      for (const z of zs) {
        for (const x of xs) {
          positions.push({ x, y, z });
          if (positions.length >= count) return;
        }
      }
    };
    const addColumns = (columns, height) => {
      for (let level = 0; level < height; level += 1) {
        for (const [x, z] of columns) {
          positions.push({ x, y: level + 1, z });
          if (positions.length >= count) return;
        }
      }
    };
    const addLine = (cells, y = 0) => {
      for (const [x, z] of cells) {
        positions.push({ x, y, z });
        if (positions.length >= count) return;
      }
    };

    if (stage === 0) addGrid([2, 3, 4, 5], [3, 4, 5]);
    else if (stage === 1) addGrid([2, 3, 4, 5], [2, 3, 4], 1);
    else if (stage === 2) addColumns([[2, 2], [5, 2], [2, 5], [5, 5]], 4);
    else if (stage === 3) addGrid([3, 4, 5], [3, 4, 5], 2);
    else if (stage === 4) addLine([[2, 2], [3, 2], [4, 2], [5, 2], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [2, 5]], 3);
    else if (stage === 5) addGrid([2, 3, 4, 5, 6], [2, 3, 4], 4);
    else if (stage === 6) addLine([[3, 6], [4, 6], [3, 7], [4, 7], [3, 8], [4, 8], [2, 8], [5, 8]], 0);
    else if (stage === 7) addLine([[6, 3], [7, 3], [6, 4], [7, 4]], 0);
    else if (stage === 8) addLine([[1, 3], [1, 4], [2, 6], [5, 6], [6, 2], [6, 5]], 1);
    else addLine([[3, 1], [4, 1], [2, 3], [5, 3], [3, 5], [4, 5]], 4);

    while (positions.length < count) {
      const i = positions.length;
      positions.push({ x: 2 + (i % 5), y: Math.floor(i / 10), z: 2 + (Math.floor(i / 5) % 5) });
    }
    return positions.slice(0, count);
  }

  function creativePreviewForTask(education) {
    if (!education || education.subjectId !== 'creative' || education.completed) return null;
    const tasks = getLessonTasks(education.subjectId, education.lesson, education.grade);
    const lastIndex = Math.max(0, Math.min(tasks.length - 1, education.taskIndex | 0));
    const blocks = [];
    for (let index = 0; index <= lastIndex; index += 1) {
      const task = tasks[index];
      if (!task) continue;
      const ids = task.type === 'placeSet' && Array.isArray(task.blocks)
        ? task.blocks.slice()
        : Array.from({ length: Math.max(1, task.count || 1) }, () => task.block);
      const positions = stagePositions(index, ids.length);
      for (let i = 0; i < ids.length; i += 1) {
        blocks.push({ id: ids[i], ...positions[i], stage: index, current: index === lastIndex });
      }
    }
    return {
      title: `После задания ${lastIndex + 1}`,
      blocks,
    };
  }

  function wordToLetterBlocks(word) {
    return String(word || '')
      .toUpperCase()
      .split('')
      .map((char) => LETTER_BY_CHAR[char])
      .filter((id) => Number.isFinite(id));
  }

  function uniqueBlocks(blocks) {
    const result = [];
    for (const id of blocks) {
      if (Number.isFinite(id) && !result.includes(id)) result.push(id);
    }
    return result;
  }

  function deterministicShuffle(list, seed) {
    const result = list.slice();
    let value = (Number(seed) || 1) >>> 0;
    for (let i = result.length - 1; i > 0; i -= 1) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const j = value % (i + 1);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function spellWordFitsHotbar(word) {
    return uniqueBlocks(wordToLetterBlocks(word)).length <= 10;
  }

  function fitSpellWordToHotbar(word) {
    const original = String(word || '').trim();
    if (!original || spellWordFitsHotbar(original)) return original;
    const parts = original.split(/\s+/).filter(Boolean);
    let best = '';
    for (const part of parts) {
      const next = best ? `${best} ${part}` : part;
      if (!spellWordFitsHotbar(next)) break;
      best = next;
    }
    if (best) return best;
    return parts.find((part) => spellWordFitsHotbar(part)) || original;
  }

  function spellTask(text, word, alphabet = 'ru') {
    const safeWord = fitSpellWordToHotbar(word);
    const safeText = safeWord === word ? text : `${text} Собери часть "${safeWord}", которая помещается в хотбар.`;
    return {
      type: 'spellWord',
      word: safeWord,
      letters: wordToLetterBlocks(safeWord),
      alphabet,
      text: safeText,
    };
  }

  function scaleCount(base, lesson, max = 9) {
    return Math.max(1, Math.min(max, base + Math.floor((clampLesson(lesson) - 1) / 16)));
  }

  function rotate(list, offset) {
    return list.map((_, i) => list[(i + offset) % list.length]);
  }

  function topicByLesson(lesson, topics) {
    const safeLesson = clampLesson(lesson);
    return topics.find((topic) => safeLesson <= topic.to) || topics[topics.length - 1];
  }

  function withLessonText(task, lesson, index) {
    if (lesson === 1) return { ...task };
    if (task.type === 'placeSet') {
      const names = (task.blocks || []).map(blockName).join(', ');
      return {
        ...task,
        text: `Урок ${lesson}, задание ${index + 1}: прочитай правило и поставь блоки: ${names}.`,
      };
    }
    const action = task.type === 'mine' ? 'добудь' : (task.type === 'near' ? 'найди рядом' : 'поставь');
    return {
      ...task,
      count: task.type === 'near' ? 1 : scaleCount(task.count || 1, lesson),
      text: `Урок ${lesson}, задание ${index + 1}: ${action} ${task.type === 'near' ? blockName(task.block) : `${scaleCount(task.count || 1, lesson)} x ${blockName(task.block)}`}.`,
    };
  }

  function lessonLanguageTasks(lesson) {
    const topics = [
      { to: 18, title: 'Звуки и буквы', items: ['а', 'о', 'у', 'и', 'э', 'ы', 'м', 'н', 'л', 'р'] },
      { to: 36, title: 'Гласные и согласные', items: ['мак', 'сом', 'лук', 'нос', 'рама', 'мир', 'кот', 'лес', 'дом', 'сад'] },
      { to: 54, title: 'Слог', items: ['ма', 'мо', 'лу', 'са', 'но', 'ра', 'ли', 'ко', 'до', 'та'] },
      { to: 70, title: 'Ударение', items: ['мама', 'лиса', 'вода', 'рука', 'гора', 'зима', 'трава', 'сова', 'река', 'окно'] },
      { to: 86, title: 'Слово и значение слова', items: ['кот', 'дом', 'лес', 'сад', 'мост', 'стол', 'книга', 'ручка', 'трава', 'солнце'] },
      { to: 100, title: 'Предложение', items: ['у дома сад', 'кот у окна', 'мама дома', 'лиса в лесу', 'река шумит', 'сова летит', 'дети идут', 'трава мокра', 'у лены книга', 'добрый мир'] },
    ];
    const topic = topicByLesson(lesson, topics);
    return Array.from({ length: 10 }, (_, index) => {
      const item = topic.items[(lesson + index - 1) % topic.items.length];
      const isLetter = item.length === 1;
      if (isLetter) {
        return {
          type: 'place',
          block: LETTER_BY_CHAR[item.toUpperCase()],
          count: 1,
          text: `Русский язык, 1 класс, урок ${lesson}. Тема: ${topic.title}. Поставь букву "${item.toUpperCase()}".`,
        };
      }
      return spellTask(`Русский язык, 1 класс, урок ${lesson}. Тема: ${topic.title}. Собери "${item}" буквами-блоками.`, item);
    });
  }

  function lessonGrade1ForeignTasks(lesson) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const pairs = ['AB', 'CD', 'EF', 'GH', 'IJ', 'KL', 'MN', 'OP', 'QR', 'ST', 'UV', 'WX', 'YZ'];
    const blends = ['SH', 'CH', 'TH', 'CK', 'EE', 'OO', 'AI', 'AY', 'OA', 'OW', 'AR', 'OR', 'ER'];
    const words = [
      { en: 'cat', ru: 'кот' },
      { en: 'dog', ru: 'собака' },
      { en: 'sun', ru: 'солнце' },
      { en: 'red', ru: 'красный' },
      { en: 'box', ru: 'коробка' },
      { en: 'pen', ru: 'ручка' },
      { en: 'map', ru: 'карта' },
      { en: 'hat', ru: 'шляпа' },
      { en: 'fish', ru: 'рыба' },
      { en: 'book', ru: 'книга' },
    ];
    const review = [
      ...letters.slice(0, 6),
      ...pairs.slice(0, 4),
      ...blends.slice(0, 5),
      ...words.map((word) => word.en),
    ];
    return Array.from({ length: 10 }, (_, index) => {
      if (lesson <= 26) {
        const letter = letters[(lesson - 1 + index) % letters.length];
        return {
          type: 'place',
          block: LETTER_BY_CHAR[letter],
          count: 1,
          text: `Иностранный язык, 1 класс, урок ${lesson}: английская буква ${letter}. Найди и поставь блок ${letter}.`,
        };
      }
      if (lesson <= 45) {
        const pair = pairs[(lesson - 27 + index) % pairs.length];
        return spellTask(`Иностранный язык, 1 класс, урок ${lesson}: повтори пару английских букв ${pair}. Поставь эти буквы-блоки.`, pair, 'en');
      }
      if (lesson <= 70) {
        const blend = blends[(lesson - 46 + index) % blends.length];
        return spellTask(`Иностранный язык, 1 класс, урок ${lesson}: буквосочетание ${blend}. Поставь английские буквы этого сочетания.`, blend, 'en');
      }
      if (lesson <= 90) {
        const word = words[(lesson - 71 + index) % words.length];
        return spellTask(`Иностранный язык, 1 класс, урок ${lesson}: прочитай короткое слово "${word.en}" (перевод: "${word.ru}") и собери его английскими буквами-блоками.`, word.en, 'en');
      }
      const item = review[(lesson - 91 + index) % review.length];
      if (item.length === 1) {
        return {
          type: 'place',
          block: LETTER_BY_CHAR[item],
          count: 1,
          text: `Иностранный язык, 1 класс, урок ${lesson}: повторение. Поставь английскую букву ${item}.`,
        };
      }
      return {
        ...spellTask(`Иностранный язык, 1 класс, урок ${lesson}: повторение. Собери "${item}" английскими буквами-блоками.`, item, 'en'),
      };
    });
  }

  function lessonReadingTasks(lesson) {
    const pool = [BLOCK.DIRT, BLOCK.WOOD, BLOCK.STONE, BLOCK.SAND, BLOCK.PLANK, BLOCK.LEAF, BLOCK.WATER];
    const size = Math.min(4, 2 + Math.floor((clampLesson(lesson) - 1) / 34));
    const plots = [
      {
        title: 'домик у ручья',
        hero: 'Миша',
        lines: [
          '{hero} вышел к ручью и увидел {names} у тихой воды',
          'Сначала он расчистил место и отложил рядом {names}',
          'Потом {hero} отметил тропинку, где пригодились {names}',
          'У берега стало светлее, когда появились {names}',
          '{hero} решил сделать маленький вход и принес {names}',
          'Над входом шумел ветер, а рядом лежали {names}',
          'К вечеру тропинка повернула туда, где были {names}',
          '{hero} проверил берег и аккуратно поставил {names}',
          'Домик у ручья стал уютнее, когда рядом появились {names}',
          'В конце {hero} оглянулся и запомнил {names}',
        ],
      },
      {
        title: 'садовая дорожка',
        hero: 'Аня',
        lines: [
          '{hero} пришла в сад и нашла {names} возле старой калитки',
          'Она начала дорожку с места, где лежали {names}',
          'У яблони {hero} остановилась и заметила {names}',
          'Дальше дорожка стала ровнее, потому что появились {names}',
          'Возле клумбы ей понадобились {names}',
          'Под листьями тихо блестели {names}',
          '{hero} повернула к лавке и увидела {names}',
          'На середине сада она аккуратно сложила {names}',
          'Дорожка почти дошла до ворот, где лежали {names}',
          'Когда работа закончилась, {hero} еще раз назвала {names}',
        ],
      },
      {
        title: 'маленький мост',
        hero: 'Тимур',
        lines: [
          '{hero} подошел к канаве и заметил {names}',
          'Для начала моста он выбрал {names}',
          'На другом берегу пригодились {names}',
          '{hero} сделал первый проход и проверил {names}',
          'Под мостом тихо виднелись {names}',
          'По краям он разложил {names}',
          'В середине моста не хватало {names}',
          '{hero} укрепил поворот и поставил {names}',
          'Теперь через канаву можно было пройти, минуя {names}',
          'Перед уходом {hero} пересчитал {names}',
        ],
      },
    ];
    const plot = plots[(lesson - 1) % plots.length];
    return Array.from({ length: 10 }, (_, index) => {
      const blocks = Array.from({ length: size }, (__, i) => pool[(lesson + index * 2 + i) % pool.length]);
      const names = blocks.map(blockName).join(', ');
      const sentence = plot.lines[index].replace('{hero}', plot.hero).replace('{names}', names);
      return {
        type: 'placeSet',
        blocks,
        text: `Текст "${plot.title}", урок ${lesson}, предложение ${index + 1}/10: ${sentence}. Поставь все блоки, которые названы в этом предложении.`,
      };
    });
  }

  function mathTask(blocks, text) {
    return {
      type: 'placeSet',
      blocks,
      text,
    };
  }

  function repeatedBlock(block, count) {
    return Array.from({ length: Math.max(1, count | 0) }, () => block);
  }

  function lessonMathTasks(lesson, grade = 1, displayLesson = lesson) {
    const safeLesson = clampLesson(lesson);
    const shownLesson = clampLesson(displayLesson);
    const gradeNumber = Number(grade) || 1;
    if (gradeNumber === 1) return lessonGrade1MathTasks(safeLesson, shownLesson);
    if (gradeNumber === 2) return lessonGrade2MathProgramTasks(safeLesson, shownLesson);
    if (gradeNumber === 3) return lessonGrade3MathProgramTasks(safeLesson, shownLesson);
    if (gradeNumber === 4) return lessonGrade4MathProgramTasks(safeLesson, shownLesson);
    if (gradeNumber === 5) return lessonGrade4MathProgramTasks(Math.min(100, safeLesson + 18), shownLesson).map((task) => ({
      ...task,
      text: task.text.replace('Математика, 4 класс', 'Математика, 5 класс'),
    }));
    return lessonGrade1MathTasks(safeLesson, shownLesson);
  }

  function lessonGrade1MathTasks(lesson, shownLesson) {
    const topic = topicByLesson(lesson, [
      { to: 14, title: 'Счет предметов и числа от 1 до 10' },
      { to: 28, title: 'Сравнение чисел и знаки больше-меньше' },
      { to: 42, title: 'Состав числа' },
      { to: 58, title: 'Сложение и вычитание в пределах 10' },
      { to: 74, title: 'Задачи на увеличение и уменьшение' },
      { to: 88, title: 'Отрезок, длина и линейка' },
      { to: 100, title: 'Числа от 11 до 20 и повторение' },
    ]);
    const add = Math.min(3, Math.floor((lesson - 1) / 28));
    const left = 2 + Math.min(4, Math.floor((lesson - 1) / 18));
    const right = left + 1;
    const row = 4 + Math.min(5, Math.floor((lesson - 1) / 18));
    const tasks = [
      mathTask(
        repeatedBlock(BLOCK.DIRT, 3 + add),
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Отсчитай ${3 + add} предмета: поставь столько блоков земли.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, left), ...repeatedBlock(BLOCK.PLANK, right)],
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Сравни две группы: ${left} камня и ${right} досок.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, 2 + add), ...repeatedBlock(BLOCK.PLANK, 1 + add)],
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Покажи состав числа ${3 + add * 2}: ${2 + add} камня и ${1 + add} доску.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.SAND, row),
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Сделай числовой ряд длиной ${row} из песка.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.WOOD, 2 + add), ...repeatedBlock(BLOCK.LEAF, 2 + add)],
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Собери пары: дерево и листья, всего ${2 + add} пары.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.PLANK, 3 + add), ...repeatedBlock(BLOCK.STONE, 3 + add)],
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Построй две равные группы: ${3 + add} досок и ${3 + add} камней.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.DIRT, 2 + add), ...repeatedBlock(BLOCK.SAND, 2), ...repeatedBlock(BLOCK.WATER, 1)],
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Разложи число ${5 + add} на части: земля, песок и вода.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.PLANK, row + 1),
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Измерь длину: выложи отрезок из ${row + 1} досок.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, 2 + add), ...repeatedBlock(BLOCK.WOOD, 2 + add), ...repeatedBlock(BLOCK.LEAF, 2 + add)],
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Собери одинаковые наборы: камень, дерево и листья.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.SAND, right), ...repeatedBlock(BLOCK.STONE, left)],
        `Математика, 1 класс, урок ${shownLesson}. Тема: ${topic.title}. Итоговое сравнение: песка ${right}, камня ${left}.`,
      ),
    ];
    return tasks;
  }

  function lessonGrade2MathProgramTasks(lesson, shownLesson) {
    const topic = topicByLesson(lesson, [
      { to: 14, title: 'Числа от 1 до 100. Десятки и единицы' },
      { to: 28, title: 'Сложение и вычитание двузначных чисел' },
      { to: 42, title: 'Задачи в два действия' },
      { to: 56, title: 'Умножение как сложение одинаковых слагаемых' },
      { to: 70, title: 'Деление на равные части' },
      { to: 84, title: 'Величины: длина, масса, время' },
      { to: 100, title: 'Геометрические фигуры и периметр' },
    ]);
    const tens = 2 + Math.min(3, Math.floor((lesson - 1) / 22));
    const ones = 3 + Math.min(4, Math.floor((lesson - 1) / 18));
    const groups = 2 + Math.min(2, Math.floor((lesson - 1) / 30));
    const perGroup = 2 + (lesson >= 60 ? 1 : 0);
    return [
      mathTask(
        [...repeatedBlock(BLOCK.STONE, tens), ...repeatedBlock(BLOCK.PLANK, ones)],
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Покажи число из десятков и единиц: ${tens} камня-десятка и ${ones} досок-единиц.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.DIRT, ones), ...repeatedBlock(BLOCK.SAND, ones + 1)],
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Сложение групп: ${ones} земли и ${ones + 1} песка.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.PLANK, tens + ones),
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Сделай ряд из ${tens + ones} досок как результат вычисления.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.WOOD, groups * perGroup),
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Умножение: ${groups} группы по ${perGroup} блока дерева.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.LEAF, groups), ...repeatedBlock(BLOCK.WOOD, groups)],
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Деление на равные пары: листья и дерево.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.SAND, 6 + Math.min(4, Math.floor((lesson - 1) / 20))),
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Величины: выложи мерную дорожку из песка.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, 4), ...repeatedBlock(BLOCK.PLANK, 4)],
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Периметр прямоугольника: сделай две стороны камнем и две стороны досками.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.DIRT, 3), ...repeatedBlock(BLOCK.SAND, 3), ...repeatedBlock(BLOCK.WATER, 1)],
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Реши задачу-модель: две группы и один дополнительный блок.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, groups), ...repeatedBlock(BLOCK.WOOD, groups), ...repeatedBlock(BLOCK.LEAF, groups)],
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Одинаковые наборы: камень, дерево и листья.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.SAND, ones + 2), ...repeatedBlock(BLOCK.STONE, ones)],
        `Математика, 2 класс, урок ${shownLesson}. Тема: ${topic.title}. Сравни результаты: песка больше, чем камня.`,
      ),
    ];
  }

  function lessonGrade3MathProgramTasks(lesson, shownLesson) {
    const topic = topicByLesson(lesson, [
      { to: 14, title: 'Нумерация чисел до 1000' },
      { to: 28, title: 'Табличное умножение и деление' },
      { to: 42, title: 'Порядок действий' },
      { to: 56, title: 'Уравнения простого вида' },
      { to: 70, title: 'Задачи на кратное сравнение' },
      { to: 84, title: 'Периметр и площадь' },
      { to: 100, title: 'Величины и итоговое повторение' },
    ]);
    const hundreds = 2 + Math.min(3, Math.floor((lesson - 1) / 25));
    const tens = 3 + Math.min(4, Math.floor((lesson - 1) / 18));
    const groups = 3 + Math.min(2, Math.floor((lesson - 1) / 30));
    const perGroup = 2 + (lesson >= 50 ? 1 : 0);
    return [
      mathTask(
        [...repeatedBlock(BLOCK.STONE, hundreds), ...repeatedBlock(BLOCK.PLANK, tens), ...repeatedBlock(BLOCK.SAND, 2)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Покажи сотни, десятки и единицы разными блоками.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.WOOD, groups * perGroup),
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Таблица умножения: ${groups} x ${perGroup} блоков дерева.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.LEAF, groups), ...repeatedBlock(BLOCK.WOOD, groups)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Деление: разложи предметы на равные пары.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, 3), ...repeatedBlock(BLOCK.PLANK, 2), ...repeatedBlock(BLOCK.SAND, 4)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Порядок действий: сначала модель в скобках, потом прибавление.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.DIRT, 4), ...repeatedBlock(BLOCK.SAND, 4)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Уравнение вида x + 4 = 8: покажи две равные части.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, groups), ...repeatedBlock(BLOCK.PLANK, groups * 2)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Кратное сравнение: досок в два раза больше, чем камней.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.WOOD, 4), ...repeatedBlock(BLOCK.PLANK, 4), ...repeatedBlock(BLOCK.LEAF, 4)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Площадь: заполни прямоугольную площадку блоками.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.SAND, 8 + Math.min(4, Math.floor((lesson - 1) / 25))),
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Величины: построй длинный отрезок для измерения.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, 3), ...repeatedBlock(BLOCK.WOOD, 3), ...repeatedBlock(BLOCK.LEAF, 3), ...repeatedBlock(BLOCK.SAND, 3)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Сложная задача: собери четыре равные группы.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.PLANK, tens), ...repeatedBlock(BLOCK.STONE, hundreds)],
        `Математика, 3 класс, урок ${shownLesson}. Тема: ${topic.title}. Итоговое сравнение разрядов: десятки и сотни.`,
      ),
    ];
  }

  function lessonGrade4MathProgramTasks(lesson, shownLesson) {
    const topic = topicByLesson(lesson, [
      { to: 14, title: 'Многозначные числа и класс миллионов' },
      { to: 28, title: 'Письменное сложение и вычитание' },
      { to: 42, title: 'Письменное умножение на однозначное и двузначное число' },
      { to: 56, title: 'Письменное деление' },
      { to: 70, title: 'Задачи на движение' },
      { to: 84, title: 'Цена, количество, стоимость и величины' },
      { to: 100, title: 'Площадь, периметр и порядок действий' },
    ]);
    const thousands = 2 + Math.min(3, Math.floor((lesson - 1) / 20));
    const hundreds = 3 + Math.min(3, Math.floor((lesson - 1) / 24));
    const groups = 4 + Math.min(2, Math.floor((lesson - 1) / 32));
    const perGroup = 2 + Math.min(2, Math.floor((lesson - 1) / 40));
    return [
      mathTask(
        [...repeatedBlock(BLOCK.BLACKSTONE, thousands), ...repeatedBlock(BLOCK.STONE, hundreds), ...repeatedBlock(BLOCK.PLANK, 4)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Покажи разряды многозначного числа: тысячи, сотни и единицы.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, hundreds), ...repeatedBlock(BLOCK.SAND, hundreds + 1)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Письменное сложение: собери две группы разного размера.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.PLANK, groups), ...repeatedBlock(BLOCK.WOOD, groups), ...repeatedBlock(BLOCK.LEAF, groups)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Письменное вычитание: покажи исходную группу, часть и остаток.`,
      ),
      mathTask(
        repeatedBlock(BLOCK.WOOD, groups * perGroup),
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Умножение: ${groups} групп по ${perGroup} блока дерева.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.PLANK, groups), ...repeatedBlock(BLOCK.STONE, groups)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Деление с проверкой: разложи блоки на равные пары.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.SAND, 6), ...repeatedBlock(BLOCK.WATER, 2), ...repeatedBlock(BLOCK.PLANK, 2)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Задача на движение: дорога, остановки и пройденный путь.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.GOLDEN_FLOWER, 3), ...repeatedBlock(BLOCK.PLANK, 6)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Цена, количество, стоимость: 3 товара и 6 блоков стоимости.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.STONE, 4), ...repeatedBlock(BLOCK.PLANK, 4), ...repeatedBlock(BLOCK.SAND, 4)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Периметр и площадь: построй рамку и заполнение.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.BLACKSTONE, 2), ...repeatedBlock(BLOCK.STONE, 3), ...repeatedBlock(BLOCK.PLANK, 4)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Порядок действий: сначала первая группа, затем вторая и итог.`,
      ),
      mathTask(
        [...repeatedBlock(BLOCK.WOOD, perGroup), ...repeatedBlock(BLOCK.LEAF, perGroup), ...repeatedBlock(BLOCK.SAND, perGroup), ...repeatedBlock(BLOCK.STONE, perGroup)],
        `Математика, 4 класс, урок ${shownLesson}. Тема: ${topic.title}. Итоговая задача: четыре равные части по ${perGroup} блока.`,
      ),
    ];
  }

  function lessonLogicTasks(lesson) {
    const base = TASKS.logic;
    if (lesson === 1) return base.map((task) => ({ ...task, blocks: task.blocks ? task.blocks.slice() : undefined }));
    const pool = [BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD, BLOCK.LEAF, BLOCK.SAND, BLOCK.WATER, BLOCK.PLANK];
    const size = Math.min(5, 2 + Math.floor((lesson - 1) / 30));
    return Array.from({ length: 10 }, (_, index) => {
      const blocks = Array.from({ length: size }, (__, i) => pool[(lesson * 2 + index + i * 2) % pool.length]);
      return {
        type: 'placeSet',
        blocks,
        text: `Логика, урок ${lesson}: выполни цепочку ${blocks.map(blockName).join(' -> ')}.`,
      };
    });
  }

  function lessonWorldTasks(lesson) {
    const base = TASKS.world;
    if (lesson === 1) return base.map((task) => ({ ...task }));
    const tasks = base.map((task, index) => withLessonText(task, lesson, index));
    if (lesson >= 75) {
      tasks[9] = {
        type: 'biome',
        biome: 'mountains',
        text: `Урок ${lesson}, задание 10: попади в биом Горы. Ищи высокие серые склоны и каменные вершины.`,
      };
    }
    return tasks;
  }

  function lessonCreativeTasks(lesson) {
    const project = creativeProjectForLesson(lesson, 1);
    const hard = lesson >= 70;
    const mid = lesson >= 35;
    const base = mid ? 8 : 6;
    const large = hard ? 12 : (mid ? 10 : 8);
    const wood = mid ? 6 : 4;
    const trim = mid ? 7 : 5;
    const detail = hard ? 10 : 6;
    const leaves = mid ? 8 : 5;
    const water = hard ? 2 : 1;
    const plans = [
      [
        [BLOCK.STONE, large, `разметь каменный постамент для проекта "${project}"`],
        [BLOCK.PLANK, base, `настели ровную площадку, на которой будет стоять "${project}"`],
        [BLOCK.WOOD, wood, `подними деревянный каркас будущей формы`],
        [BLOCK.STONE, detail, `собери главный объем постройки камнем`],
        [BLOCK.PLANK, trim, `добавь деревянные ребра, ступени или бортики`],
        [BLOCK.LEAF, leaves, `смягчи силуэт зелеными вставками`],
        [BLOCK.SAND, base, `оформи нижний край песочной дорожкой`],
        [BLOCK.WATER, water, `добавь водную деталь рядом с композицией`],
      ],
      [
        [BLOCK.PLANK, large, `сделай широкое деревянное основание для проекта "${project}"`],
        [BLOCK.WOOD, wood, `поставь стойки по углам`],
        [BLOCK.STONE, base, `укрепи центр каменными блоками`],
        [BLOCK.LEAF, leaves, `обозначь навес, крону или мягкий верх`],
        [BLOCK.SAND, trim, `выложи светлый вход или дорожку`],
        [BLOCK.PLANK, detail, `добавь настилы, полки или боковые панели`],
        [BLOCK.WATER, water, `поставь водный акцент как часть сцены`],
        [BLOCK.STONE, detail, `заверши прочные детали камнем`],
      ],
      [
        [BLOCK.SAND, large, `нарисуй на земле контур проекта "${project}" песком`],
        [BLOCK.STONE, base, `поставь каменные углы или опорные точки`],
        [BLOCK.PLANK, trim, `соедини контур досками`],
        [BLOCK.WOOD, wood, `подними вертикальные элементы`],
        [BLOCK.LEAF, leaves, `добавь природные акценты`],
        [BLOCK.SAND, detail, `усиль рисунок вторым песочным слоем`],
        [BLOCK.WATER, water, `сделай маленький водный центр или край`],
        [BLOCK.STONE, detail, `закрепи композицию каменными деталями`],
      ],
      [
        [BLOCK.WOOD, wood + 2, `начни проект "${project}" с деревянного скелета`],
        [BLOCK.STONE, large, `создай тяжелое каменное основание`],
        [BLOCK.PLANK, base, `добавь рабочие площадки из досок`],
        [BLOCK.WOOD, wood, `поставь вторую линию опор`],
        [BLOCK.LEAF, leaves, `прикрой или укрась верх листьями`],
        [BLOCK.SAND, trim, `проведи песочную дорожку к постройке`],
        [BLOCK.PLANK, detail, `добавь мелкие деревянные детали`],
        [BLOCK.WATER, water, `поставь воду как финальный акцент`],
      ],
    ];
    const planIndex = (lesson - 1) % plans.length;
    const plan = plans[planIndex];
    const tasks = plan.map(([block, count, text]) => ({
      type: 'place',
      block,
      count,
      text: `Урок ${lesson}: ${text}: поставь ${count} x ${blockName(block)}.`,
    }));
    const finales = [
      [
        [[BLOCK.WOOD, BLOCK.PLANK, BLOCK.LEAF], `Урок ${lesson}: проект "${project}". Проверь силуэт и добавь живые финальные детали: дерево, доски и листья.`],
        [[BLOCK.STONE, BLOCK.SAND, BLOCK.PLANK], `Урок ${lesson}: проект "${project}". Сделай завершающую отделку тремя материалами: камень, песок и доски.`],
      ],
      [
        [[BLOCK.SAND, BLOCK.WATER, BLOCK.LEAF], `Урок ${lesson}: проект "${project}". Оформи место вокруг постройки песком, водой и листьями.`],
        [[BLOCK.WOOD, BLOCK.STONE, BLOCK.PLANK], `Урок ${lesson}: проект "${project}". Укрепи вход или край деревом, камнем и досками.`],
      ],
      [
        [[BLOCK.PLANK, BLOCK.LEAF, BLOCK.WATER], `Урок ${lesson}: проект "${project}". Добавь небольшой маршрут из досок, листьев и воды.`],
        [[BLOCK.SAND, BLOCK.STONE, BLOCK.WOOD], `Урок ${lesson}: проект "${project}". Подчеркни контур песком, камнем и деревом.`],
      ],
      [
        [[BLOCK.STONE, BLOCK.WOOD, BLOCK.LEAF], `Урок ${lesson}: проект "${project}". Выдели верх или центр камнем, деревом и листьями.`],
        [[BLOCK.PLANK, BLOCK.SAND, BLOCK.WATER], `Урок ${lesson}: проект "${project}". Заверши сцену досками, песком и водой.`],
      ],
    ];
    for (const [blocks, text] of finales[planIndex]) {
      tasks.push({
        type: 'placeSet',
        blocks,
        text: `${text} Поставь по 1 блоку: ${blocks.map(blockName).join(', ')}.`,
      });
    }
    return tasks;
  }

  function lessonGrade2LanguageTasks(lesson) {
    const topics = [
      { to: 14, title: 'Текст и предложение', items: ['кот спит', 'дети идут', 'у дома сад', 'река шумит', 'сова летит', 'мама дома', 'лиса в лесу', 'трава мокра', 'у лены книга', 'добрый мир'] },
      { to: 28, title: 'Слова-предметы', items: ['кот', 'дом', 'лес', 'сад', 'стол', 'книга', 'ручка', 'река', 'трава', 'солнце'] },
      { to: 42, title: 'Слова-признаки', items: ['малый', 'новый', 'добрый', 'синий', 'зеленый', 'тихий', 'светлый', 'быстрый', 'мокрый', 'теплый'] },
      { to: 56, title: 'Слова-действия', items: ['идет', 'летит', 'шумит', 'растет', 'читает', 'пишет', 'играет', 'строит', 'смотрит', 'несет'] },
      { to: 70, title: 'Корень слова и родственные слова', items: ['лес', 'лесок', 'лесной', 'сад', 'садик', 'садовый', 'дом', 'домик', 'вода', 'водный'] },
      { to: 84, title: 'Безударные гласные', items: ['вода', 'гора', 'трава', 'зима', 'лиса', 'сова', 'река', 'дома', 'поля', 'моря'] },
      { to: 100, title: 'Парные согласные и перенос', items: ['дуб', 'гриб', 'зуб', 'луг', 'снег', 'пруд', 'хлеб', 'мороз', 'берег', 'город'] },
    ];
    const topic = topicByLesson(lesson, topics);
    return Array.from({ length: 10 }, (_, index) => {
      const item = topic.items[(lesson + index - 1) % topic.items.length];
      return spellTask(`Русский язык, 2 класс, урок ${lesson}. Тема: ${topic.title}. Собери "${item}" буквами-блоками.`, item);
    });
  }

  function lessonGrade3LanguageTasks(lesson) {
    const topics = [
      { to: 14, title: 'Текст и предложение', items: ['дети идут в сад', 'кот сидит у окна', 'река шумит', 'сова летит в лес', 'у лены книга', 'трава мокра утром', 'добрый мир мал', 'лиса ела малину', 'мама мыла раму', 'у дома рос сад'] },
      { to: 28, title: 'Имя существительное', items: ['лес растет', 'река шумит', 'книга лежит', 'город спит', 'ученик читает', 'солнце светит', 'птица летит', 'дорога идет', 'дом стоит', 'трава растет'] },
      { to: 42, title: 'Имя прилагательное', items: ['синий дом', 'добрый друг', 'зеленый лес', 'тихая река', 'новая книга', 'мокрая трава', 'теплый день', 'малый сад', 'светлый класс', 'быстрый конь'] },
      { to: 56, title: 'Глагол', items: ['дети читают', 'птицы летят', 'реки шумят', 'цветы растут', 'ученики пишут', 'ребята играют', 'мастера строят', 'друзья идут', 'окна светят', 'ручьи бегут'] },
      { to: 70, title: 'Род и число имен', items: ['новый дом', 'новые дома', 'синий стол', 'синие столы', 'добрая мама', 'добрые дети', 'тихая река', 'тихие реки', 'зеленый лист', 'зеленые листья'] },
      { to: 84, title: 'Предлоги', items: ['кот у дома', 'книга на столе', 'мост у реки', 'сад за домом', 'птица в лесу', 'ручка в пенале', 'дети у школы', 'лист на траве', 'мяч под столом', 'дом у реки'] },
      { to: 100, title: 'Орфограммы в корне', items: ['лесной дом', 'водный путь', 'садовый мост', 'грибной лес', 'снежный двор', 'морозный день', 'берег реки', 'город у моря', 'звездный вечер', 'добрый класс'] },
    ];
    const topic = topicByLesson(lesson, topics);
    return Array.from({ length: 10 }, (_, index) => {
      const sentence = topic.items[(lesson + index - 1) % topic.items.length];
      return spellTask(`Русский язык, 3 класс, урок ${lesson}. Тема: ${topic.title}. Собери "${sentence}" буквами-блоками.`, sentence);
    });
  }

  function lessonGrade4LanguageTasks(lesson) {
    const topics = [
      { to: 12, title: 'Текст, предложение, обращение', items: ['текст', 'тема', 'абзац', 'заголовок', 'мысль', 'обращение', 'друг', 'ребята', 'письмо', 'читай'] },
      { to: 24, title: 'Главные и второстепенные члены предложения', items: ['основа', 'сказуемое', 'подлежащее', 'главные', 'вторые', 'кто', 'что', 'делает', 'где', 'когда'] },
      { to: 38, title: 'Имя существительное и падежи', items: ['лес', 'леса', 'к лесу', 'вижу лес', 'лесом', 'о лесе', 'дом', 'к дому', 'домом', 'о доме'] },
      { to: 52, title: 'Имя прилагательное', items: ['синий', 'синего', 'синему', 'зеленый', 'зеленого', 'добрый', 'доброго', 'новые', 'светлый', 'теплая'] },
      { to: 66, title: 'Местоимение', items: ['я', 'ты', 'он', 'она', 'мы', 'вы', 'они', 'меня', 'тебя', 'нами'] },
      { to: 82, title: 'Глагол, время и спряжение', items: ['читаю', 'читаем', 'строишь', 'строят', 'видел', 'увидит', 'пишут', 'летят', 'растет', 'помогут'] },
      { to: 100, title: 'Орфограммы и повторение', items: ['гласная', 'согласная', 'корень', 'приставка', 'суффикс', 'окончание', 'проверка', 'мягкий знак', 'парный звук', 'словарь'] },
    ];
    const topic = topicByLesson(lesson, topics);
    return Array.from({ length: 10 }, (_, index) => {
      const item = topic.items[(lesson + index - 1) % topic.items.length];
      return spellTask(`Русский язык, 4 класс, урок ${lesson}. Тема: ${topic.title}. Собери "${item}" буквами-блоками.`, item);
    });
  }

  function lessonGrade2ReadingTasks(lesson) {
    const pool = [BLOCK.DIRT, BLOCK.WOOD, BLOCK.STONE, BLOCK.SAND, BLOCK.PLANK, BLOCK.LEAF, BLOCK.WATER];
    const size = Math.min(5, 3 + Math.floor((lesson - 1) / 28));
    const plots = [
      {
        title: 'Башня на холме',
        hero: 'Лена',
        lines: [
          '{hero} поднялась на холм утром и увидела внизу {names}',
          'Она решила построить башню-маяк, поэтому сначала выбрала {names}',
          'У подножия холма тропа была неровной, и там пригодились {names}',
          'Когда основание стало крепче, {hero} принесла к нему {names}',
          'Ветер шумел над вершиной, а возле будущей стены лежали {names}',
          'К полудню башня уже была заметна издалека, потому что появились {names}',
          '{hero} сделала маленькую площадку для фонаря и аккуратно поставила {names}',
          'С холма открылся вид на ручей, где тихо блестели {names}',
          'Перед закатом она укрепила последний угол и проверила {names}',
          'Когда башня была готова, {hero} спустилась вниз и еще раз запомнила {names}',
        ],
      },
      {
        title: 'Письмо из лесной мастерской',
        hero: 'Илья',
        lines: [
          '{hero} получил письмо о старой мастерской и сразу собрал {names}',
          'Дорога вела через лес, где под ногами встречались {names}',
          'У двери мастерской он остановился и заметил {names}',
          'Внутри было темно, но на столе лежали {names}',
          '{hero} решил починить крышу и вынес наружу {names}',
          'За окном шумели деревья, а возле стены пригодились {names}',
          'После работы он открыл окно и увидел за ним {names}',
          'На полу мастерской остались следы, рядом с которыми лежали {names}',
          '{hero} написал ответное письмо и описал в нем {names}',
          'Перед уходом он закрыл дверь и оставил у порога {names}',
        ],
      },
      {
        title: 'Причал у тихого озера',
        hero: 'Соня',
        lines: [
          '{hero} пришла к озеру и увидела на берегу {names}',
          'Сначала она отметила место для причала и принесла {names}',
          'Вода была спокойной, поэтому рядом хорошо смотрелись {names}',
          'Чтобы пройти к лодке, {hero} разложила вдоль берега {names}',
          'У старого камня она остановилась и заметила {names}',
          'К середине дня причал стал длиннее, когда появились {names}',
          '{hero} сделала маленькую ступеньку и укрепила ее с помощью {names}',
          'Над озером пролетела тень, а на берегу остались {names}',
          'Перед вечером она проверила край причала и поправила {names}',
          'Когда вода стала темной, {hero} ушла домой, запомнив {names}',
        ],
      },
    ];
    const plot = plots[(lesson - 1) % plots.length];
    return Array.from({ length: 10 }, (_, index) => {
      const blocks = Array.from({ length: size }, (__, i) => pool[(lesson + index * 3 + i) % pool.length]);
      const names = blocks.map(blockName).join(', ');
      const sentence = plot.lines[index].replace('{hero}', plot.hero).replace('{names}', names);
      return {
        type: 'placeSet',
        blocks,
        text: `Литературное чтение "${plot.title}", урок ${lesson}, предложение ${index + 1}/10: ${sentence}. Поставь все блоки, названные в этом предложении.`,
      };
    });
  }

  function lessonGrade3ReadingTasks(lesson) {
    const tasks = lessonGrade2ReadingTasks(Math.min(100, lesson + 18));
    return tasks.map((task) => ({
      ...task,
      text: `Литературное чтение, 3 класс. ${task.text}`,
    }));
  }

  function englishReadingSetByIndex(index) {
    const start = index * 10;
    return ENGLISH_READING_WORDS.slice(start, start + 10);
  }

  function englishReadingKnownWords(lesson) {
    const setCount = Math.ceil(ENGLISH_READING_WORDS.length / 10);
    const pairIndex = Math.floor((clampLesson(lesson) - 1) / 2);
    const knownCount = Math.min(ENGLISH_READING_WORDS.length, Math.max(10, (Math.min(pairIndex, setCount - 1) + 1) * 10));
    return ENGLISH_READING_WORDS.slice(0, knownCount);
  }

  function lessonEnglishReadingTasks(lesson) {
    const setCount = Math.ceil(ENGLISH_READING_WORDS.length / 10);
    const pairIndex = Math.floor((clampLesson(lesson) - 1) / 2);
    const activeSet = englishReadingSetByIndex(pairIndex);
    if (activeSet.length && lesson <= setCount * 2 && lesson % 2 === 1) {
      return activeSet.map((item, index) => ({
        type: 'place',
        block: item.block,
        count: 1,
        text: `Англоязычное чтение, урок ${lesson}, слово ${index + 1}/10: "${item.en}" значит "${item.ru}". Поставь этот блок.`,
      }));
    }
    const words = activeSet.length && lesson <= setCount * 2
      ? activeSet
      : englishReadingKnownWords(lesson);
    const scenes = [
      'I see {a} and {b} near {c}.',
      'Put {a} by {b} and read the word {c}.',
      'The small path has {a}, {b}, and {c}.',
      'A builder takes {a} and {b} for the {c}.',
      'In the game world, {a} stands beside {b}.',
      'Find {a}, then add {b} and {c}.',
      'The lesson text says: {a}, {b}, {c}.',
      'A player reads about {a} near {b}.',
      'This short story uses {a}, {b}, and {c}.',
      'Remember the blocks: {a}, {b}, {c}.',
    ];
    return Array.from({ length: 10 }, (_, index) => {
      const a = words[(lesson + index) % words.length];
      const b = words[(lesson + index + 3) % words.length];
      const c = words[(lesson + index + 6) % words.length];
      const sentence = scenes[index % scenes.length]
        .replace('{a}', a.en)
        .replace('{b}', b.en)
        .replace('{c}', c.en);
      const blocks = uniqueBlocks([a.block, b.block, c.block]);
      return {
        type: 'placeSet',
        blocks,
        text: `Англоязычное чтение, урок ${lesson}: ${sentence} Перевод слов: ${a.en} - ${a.ru}, ${b.en} - ${b.ru}, ${c.en} - ${c.ru}. Поставь названные блоки.`,
      };
    });
  }

  function foreignWordSet(lesson) {
    const pairIndex = Math.floor((clampLesson(lesson) - 1) / 2);
    const start = (pairIndex * 5) % FOREIGN_WORDS.length;
    return Array.from({ length: 5 }, (_, i) => FOREIGN_WORDS[(start + i) % FOREIGN_WORDS.length]);
  }

  function foreignWordFact(item, index) {
    const facts = [
      `Слово "${item.en}" часто встречается в коротких рассказах и простых подписях к картинкам.`,
      `Слово "${item.en}" удобно запоминать вместе с образом: представь предмет или место "${item.ru}".`,
      `Когда видишь "${item.en}" в игре или книге, сначала вспоминай русский смысл "${item.ru}".`,
      `Слово "${item.en}" можно повторять вслух коротко, а потом сразу собирать перевод "${item.ru}".`,
      `Это слово полезно для описания мира вокруг героя: "${item.en}" значит "${item.ru}".`,
    ];
    return facts[index % facts.length];
  }

  function lessonForeignTasks(lesson) {
    const words = foreignWordSet(lesson);
    const learning = lesson % 2 === 1;
    return Array.from({ length: 10 }, (_, index) => {
      const item = words[index % words.length];
      if (learning) {
        const prefix = index < 5
          ? `${item.en} значит "${item.ru}".`
          : `Запомни еще раз: ${item.en} - это "${item.ru}".`;
        return spellTask(`Иностранный язык, урок ${lesson}: ${prefix} Собери русский перевод буквами-блоками.`, item.ru);
      }
      if (index >= 5) {
        return spellTask(`Иностранный язык, урок ${lesson}: факт о слове. ${foreignWordFact(item, index - 5)} Собери русский перевод буквами-блоками.`, item.ru);
      }
      return spellTask(`Иностранный язык, урок ${lesson}: переведи "${item.en}" на русский буквами-блоками.`, item.ru);
    });
  }

  function lessonGrade2ForeignTasks(lesson) {
    const words = [
      { en: 'cat', ru: 'кот' },
      { en: 'dog', ru: 'собака' },
      { en: 'book', ru: 'книга' },
      { en: 'pen', ru: 'ручка' },
      { en: 'red', ru: 'красный' },
      { en: 'blue', ru: 'синий' },
      { en: 'sun', ru: 'солнце' },
      { en: 'tree', ru: 'дерево' },
      { en: 'fish', ru: 'рыба' },
      { en: 'home', ru: 'дом' },
    ];
    const phrases = [
      { en: 'red pen', ru: 'красная ручка' },
      { en: 'blue box', ru: 'синяя коробка' },
      { en: 'my cat', ru: 'мой кот' },
      { en: 'my dog', ru: 'моя собака' },
      { en: 'big tree', ru: 'большое дерево' },
      { en: 'little fish', ru: 'маленькая рыба' },
      { en: 'green leaf', ru: 'зеленый лист' },
      { en: 'yellow sun', ru: 'желтое солнце' },
      { en: 'school bag', ru: 'школьная сумка' },
      { en: 'good book', ru: 'хорошая книга' },
    ];
    const shortPhrases = [
      { en: 'I can run', ru: 'я умею бегать' },
      { en: 'I can jump', ru: 'я умею прыгать' },
      { en: 'I see cat', ru: 'я вижу кота' },
      { en: 'I see dog', ru: 'я вижу собаку' },
      { en: 'I like sun', ru: 'мне нравится солнце' },
      { en: 'I like fish', ru: 'мне нравится рыба' },
      { en: 'we can read', ru: 'мы умеем читать' },
      { en: 'we can play', ru: 'мы умеем играть' },
      { en: 'it is red', ru: 'это красное' },
      { en: 'it is blue', ru: 'это синее' },
    ];
    const pool = lesson <= 40 ? words : (lesson <= 75 ? phrases : shortPhrases);
    const label = lesson <= 40 ? 'слово' : (lesson <= 75 ? 'короткую фразу' : 'простую фразу');
    return Array.from({ length: 10 }, (_, index) => {
      const item = pool[(lesson - 1 + index) % pool.length];
      return spellTask(`Иностранный язык, 2 класс, урок ${lesson}: собери ${label} "${item.en}" (перевод: "${item.ru}") английскими буквами-блоками.`, item.en, 'en');
    });
  }

  function lessonGrade3ForeignTasks(lesson) {
    const sentences = [
      { en: 'cat on mat', ru: 'кот на коврике' },
      { en: 'dog in house', ru: 'собака в доме' },
      { en: 'red sun up', ru: 'красное солнце наверху' },
      { en: 'we read books', ru: 'мы читаем книги' },
      { en: 'I see a tree', ru: 'я вижу дерево' },
      { en: 'big blue sky', ru: 'большое синее небо' },
      { en: 'fish in water', ru: 'рыба в воде' },
      { en: 'my friend runs', ru: 'мой друг бежит' },
      { en: 'green leaf falls', ru: 'зеленый лист падает' },
      { en: 'small star shines', ru: 'маленькая звезда светит' },
    ];
    const offset = (lesson - 1) % sentences.length;
    return Array.from({ length: 10 }, (_, index) => {
      const sentence = sentences[(offset + index) % sentences.length];
      return spellTask(`Иностранный язык, 3 класс, урок ${lesson}: собери английское предложение "${sentence.en}" (перевод: "${sentence.ru}") английскими буквами-блоками.`, sentence.en, 'en');
    });
  }

  function lessonGrade4ForeignTasks(lesson) {
    const topics = [
      {
        to: 18,
        title: 'Школа и учебные предметы',
        items: [
          { en: 'read', ru: 'читать' },
          { en: 'write', ru: 'писать' },
          { en: 'book', ru: 'книга' },
          { en: 'class', ru: 'класс' },
          { en: 'lesson', ru: 'урок' },
        ],
      },
      {
        to: 36,
        title: 'Семья, дом и распорядок дня',
        items: [
          { en: 'family', ru: 'семья' },
          { en: 'home', ru: 'дом' },
          { en: 'morning', ru: 'утро' },
          { en: 'dinner', ru: 'ужин' },
          { en: 'room', ru: 'комната' },
        ],
      },
      {
        to: 54,
        title: 'Еда, покупки и счет',
        items: [
          { en: 'apple', ru: 'яблоко' },
          { en: 'cake', ru: 'пирог' },
          { en: 'bread', ru: 'хлеб' },
          { en: 'milk', ru: 'молоко' },
          { en: 'fruit', ru: 'фрукты' },
        ],
      },
      {
        to: 72,
        title: 'Город, природа и погода',
        items: [
          { en: 'city', ru: 'город' },
          { en: 'cold day', ru: 'холодный день' },
          { en: 'river', ru: 'река' },
          { en: 'sky', ru: 'небо' },
          { en: 'park', ru: 'парк' },
        ],
      },
      {
        to: 100,
        title: 'Простые тексты и повторение',
        items: [
          { en: 'story', ru: 'рассказ' },
          { en: 'friend', ru: 'друг' },
          { en: 'green tree', ru: 'зеленое дерево' },
          { en: 'letter', ru: 'письмо' },
          { en: 'small house', ru: 'маленький дом' },
        ],
      },
    ];
    const topic = topicByLesson(lesson, topics);
    return Array.from({ length: 10 }, (_, index) => {
      const item = topic.items[(lesson + index - 1) % topic.items.length];
      return spellTask(`Иностранный язык, 4 класс, урок ${lesson}. Тема: ${topic.title}. Собери английское слово или фразу "${item.en}" (перевод: "${item.ru}") английскими буквами-блоками.`, item.en, 'en');
    });
  }

  function lessonGrade5LanguageTasks(lesson) {
    const topics = [
      { to: 14, title: 'Повторение и культура речи', items: ['речь', 'текст', 'тема', 'абзац', 'план', 'стиль', 'диалог', 'монолог', 'ошибка', 'норма'] },
      { to: 28, title: 'Фонетика и орфоэпия', items: ['звук', 'буква', 'слог', 'ударение', 'гласный', 'согласный', 'звонкий', 'глухой', 'мягкий', 'твердый'] },
      { to: 42, title: 'Морфемика', items: ['корень', 'приставка', 'суффикс', 'окончание', 'основа', 'лесной', 'подход', 'школьник', 'запись', 'переход'] },
      { to: 56, title: 'Лексика', items: ['слово', 'лексика', 'синоним', 'антоним', 'омоним', 'значение', 'словарь', 'прямое', 'перенос', 'образ'] },
      { to: 72, title: 'Имя существительное', items: ['предмет', 'род', 'число', 'падеж', 'склонение', 'земля', 'камень', 'дорога', 'ученик', 'город'] },
      { to: 86, title: 'Глагол и имя прилагательное', items: ['действие', 'признак', 'время', 'лицо', 'число', 'строит', 'читает', 'синий', 'добрый', 'быстрый'] },
      { to: 100, title: 'Синтаксис и пунктуация', items: ['основа', 'сказуемое', 'подлежащее', 'запятая', 'точка', 'вопрос', 'союз', 'простое', 'сложное', 'схема'] },
    ];
    const topic = topicByLesson(lesson, topics);
    return Array.from({ length: 10 }, (_, index) => {
      const item = topic.items[(lesson + index - 1) % topic.items.length];
      return spellTask(`Русский язык, 5 класс, урок ${lesson}. Тема: ${topic.title}. Собери "${item}" буквами-блоками.`, item);
    });
  }

  function lessonGrade5ForeignTasks(lesson) {
    const topics = [
      { to: 18, title: 'School and timetable', items: [{ en: 'school', ru: 'школа' }, { en: 'class', ru: 'класс' }, { en: 'teacher', ru: 'учитель' }, { en: 'lesson', ru: 'урок' }, { en: 'homework', ru: 'домашняя работа' }] },
      { to: 36, title: 'Family and daily life', items: [{ en: 'family', ru: 'семья' }, { en: 'mother', ru: 'мама' }, { en: 'father', ru: 'папа' }, { en: 'morning', ru: 'утро' }, { en: 'evening', ru: 'вечер' }] },
      { to: 54, title: 'Food and shopping', items: [{ en: 'bread', ru: 'хлеб' }, { en: 'milk', ru: 'молоко' }, { en: 'apple', ru: 'яблоко' }, { en: 'market', ru: 'рынок' }, { en: 'price', ru: 'цена' }] },
      { to: 72, title: 'City and nature', items: [{ en: 'city', ru: 'город' }, { en: 'river', ru: 'река' }, { en: 'forest', ru: 'лес' }, { en: 'mountain', ru: 'гора' }, { en: 'weather', ru: 'погода' }] },
      { to: 100, title: 'Simple stories', items: [{ en: 'story', ru: 'рассказ' }, { en: 'friend', ru: 'друг' }, { en: 'travel', ru: 'путешествие' }, { en: 'green tree', ru: 'зеленое дерево' }, { en: 'small house', ru: 'маленький дом' }] },
    ];
    const topic = topicByLesson(lesson, topics);
    return Array.from({ length: 10 }, (_, index) => {
      const item = topic.items[(lesson + index - 1) % topic.items.length];
      return spellTask(`Иностранный язык, 5 класс, урок ${lesson}. Тема: ${topic.title}. Собери "${item.en}" (перевод: "${item.ru}") английскими буквами-блоками.`, item.en, 'en');
    });
  }

  function lessonGrade5HistoryTasks(lesson) {
    const topic = topicByLesson(lesson, [
      { to: 14, title: 'Что изучает история и исторические источники' },
      { to: 28, title: 'Археология и счет лет' },
      { to: 42, title: 'Древние люди и первые стоянки' },
      { to: 56, title: 'Земледелие, скотоводство и ремесла' },
      { to: 70, title: 'Древние города и государства' },
      { to: 84, title: 'Письменность и культура древнего мира' },
      { to: 100, title: 'Итоговое повторение древней истории' },
    ]);
    const sets = [
      [[BLOCK.SAND, BLOCK.STONE], 'место раскопок'],
      [[BLOCK.DIRT, BLOCK.WOOD, BLOCK.LEAF], 'стоянку древних людей'],
      [[BLOCK.STONE, BLOCK.PLANK, BLOCK.WOOD], 'поселение с мастерской'],
      [[BLOCK.SAND, BLOCK.WATER, BLOCK.DIRT], 'долину у реки'],
      [[BLOCK.STONE, BLOCK.BLACKSTONE, BLOCK.PLANK], 'стену древнего города'],
      [[BLOCK.WOOD, BLOCK.PLANK, BLOCK.CHEST], 'склад ремесленников'],
      [[BLOCK.PILLAR, BLOCK.STONE, BLOCK.SAND], 'площадь древнего города'],
      [[BLOCK.PATH, BLOCK.STONE, BLOCK.WOOD], 'дорогу между поселениями'],
      [[BLOCK.PLANK, BLOCK.CHEST, BLOCK.GOLDEN_FLOWER], 'место обмена товарами'],
      [[BLOCK.STONE, BLOCK.PILLAR, BLOCK.PLANK], 'простую постройку культуры'],
    ];
    return sets.map(([blocks, model], index) => ({
      type: 'placeSet',
      blocks,
      text: `История, 5 класс, урок ${lesson}. Тема: ${topic.title}. Построй модель "${model}": поставь ${blocks.map(blockName).join(', ')}.`,
    }));
  }

  function lessonGrade5GeographyTasks(lesson) {
    const topic = topicByLesson(lesson, [
      { to: 12, title: 'Карта и глобус' },
      { to: 24, title: 'Стороны горизонта и план местности' },
      { to: 38, title: 'Масштаб и условные знаки' },
      { to: 52, title: 'Рельеф: равнины и горы' },
      { to: 66, title: 'Вода на Земле' },
      { to: 82, title: 'Материки, океаны и природные зоны' },
      { to: 100, title: 'Погода, климат и человек на карте' },
    ]);
    const tasks = [
      { type: 'place', block: BLOCK.GLOBE, count: 1, text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Поставь глобус, потом ПКМ по нему откроет карту.` },
      { type: 'near', block: BLOCK.WATER, count: 1, text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Найди воду как модель реки, озера или океана.` },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.WATER, BLOCK.STONE], text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Собери условную карту: песок, вода и камень.` },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.PLANK, BLOCK.LEAF], text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Покажи план местности: земля, дорожка и растительность.` },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.BLACKSTONE, BLOCK.SAND], text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Построй модель рельефа: гора, склон и равнина.` },
      { type: 'biome', biome: 'mountains', text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Найди биом Горы.` },
      { type: 'placeSet', blocks: [BLOCK.WATER, BLOCK.SAND, BLOCK.LEAF], text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Покажи природную зону у воды.` },
      { type: 'placeSet', blocks: [BLOCK.PATH, BLOCK.DIRT, BLOCK.PLANK], text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Построй маршрут по плану местности.` },
      { type: 'placeSet', blocks: [BLOCK.SNOW, BLOCK.STONE, BLOCK.WATER], text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Покажи холодную область, горы и воду.` },
      { type: 'placeSet', blocks: [BLOCK.GLOBE, BLOCK.WATER, BLOCK.SAND], text: `География, 5 класс, урок ${lesson}. Тема: ${topic.title}. Итог: глобус, океан и суша.` },
    ];
    return tasks;
  }

  function lessonGrade5BiologyTasks(lesson) {
    const topic = topicByLesson(lesson, [
      { to: 14, title: 'Живая и неживая природа' },
      { to: 28, title: 'Растения и условия жизни' },
      { to: 42, title: 'Животные и наблюдение' },
      { to: 56, title: 'Грибы, водоросли и простые организмы' },
      { to: 70, title: 'Среда обитания' },
      { to: 84, title: 'Питание и простые цепочки' },
      { to: 100, title: 'Охрана природы и повторение' },
    ]);
    const animalTasks = [
      { mob: 'sheep', label: 'овце' },
      { mob: 'boar', label: 'кабану' },
      { mob: 'turtle', label: 'черепахе' },
      { mob: 'snake', label: 'змее' },
      { mob: 'goat', label: 'горному козлу' },
      { mob: 'fish', label: 'рыбе' },
      { mob: 'fox', label: 'лисе' },
      { mob: 'bear', label: 'медведю' },
    ];
    const selected = animalTasks[(lesson - 1) % animalTasks.length];
    return [
      { type: 'near', block: BLOCK.LEAF, count: 1, text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Найди листья как часть растения.` },
      { type: 'near', block: BLOCK.WOOD, count: 1, text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Подойди к стволу дерева.` },
      { type: 'near', block: BLOCK.WATER, count: 1, text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Найди воду как условие жизни.` },
      { type: 'nearMob', mob: selected.mob, count: 1, text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Подойди к ${selected.label} и понаблюдай за животным.` },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.WATER, BLOCK.LEAF], text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Построй модель условий для растения: почва, вода и листья.` },
      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.LEAF, BLOCK.WATER], text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Построй модель растения: стебель, листья и вода.` },
      { type: 'placeSet', blocks: [BLOCK.MOSS, BLOCK.SMALL_WHITE_MUSHROOM, BLOCK.DIRT], text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Покажи лесную подстилку, мох и гриб.` },
      { type: 'placeSet', blocks: [BLOCK.WATER, BLOCK.ALGAE, BLOCK.LEAF], text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Покажи водную среду обитания и растения рядом.` },
      { type: 'placeSet', blocks: [BLOCK.LEAF, BLOCK.WOOD, BLOCK.DIRT, BLOCK.WATER], text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Собери простую цепочку среды: земля, вода, растение.` },
      { type: 'placeSet', blocks: [BLOCK.LEAF, BLOCK.WATER, BLOCK.MOSS], text: `Биология, 5 класс, урок ${lesson}. Тема: ${topic.title}. Итог: сохрани модель живой природы.` },
    ];
  }

  function lessonGrade2MathTasks(lesson) {
    return lessonMathTasks(lesson, 2, lesson);
  }

  function lessonGrade2WorldTasks(lesson) {
    const tasks = lessonWorldTasks(Math.min(100, lesson + 20));
    return tasks.map((task) => ({
      ...task,
      text: `Окружающий мир, 2 класс. ${task.text}`,
    }));
  }

  function lessonGrade2LogicTasks(lesson) {
    const tasks = lessonLogicTasks(Math.min(100, lesson + 20));
    return tasks.map((task) => ({
      ...task,
      text: `Логика, 2 класс. ${task.text}`,
    }));
  }

  function lessonGrade2CreativeTasks(lesson) {
    const tasks = lessonCreativeTasks(Math.min(100, lesson + 15));
    return tasks.map((task) => {
      const next = { ...task };
      if (next.type === 'place') {
        next.count = Math.min(14, (next.count || 1) + 2);
        next.text = next.text.replace(/поставь \d+ x [^.]+/i, `поставь ${next.count} x ${blockName(next.block)}`);
      }
      next.text = `Творчество, 2 класс. ${next.text}`;
      return next;
    });
  }

  function lessonGrade3MathTasks(lesson) {
    return lessonMathTasks(lesson, 3, lesson);
  }

  function lessonGrade4MathTasks(lesson) {
    return lessonMathTasks(lesson, 4, lesson);
  }

  function lessonGrade5MathTasks(lesson) {
    return lessonMathTasks(lesson, 5, lesson);
  }

  function lessonGrade3WorldTasks(lesson) {
    const tasks = lessonWorldTasks(Math.min(100, lesson + 38));
    return tasks.map((task) => ({
      ...task,
      text: `Окружающий мир, 3 класс. ${task.text}`,
    }));
  }

  function lessonGrade3CreativeTasks(lesson) {
    const tasks = lessonCreativeTasks(Math.min(100, lesson + 30));
    return tasks.map((task) => {
      const next = { ...task };
      if (next.type === 'place') {
        next.count = Math.min(16, (next.count || 1) + 4);
        next.text = next.text.replace(/поставь \d+ x [^.]+/i, `поставь ${next.count} x ${blockName(next.block)}`);
      }
      next.text = `Творчество, 3 класс. ${next.text}`;
      return next;
    });
  }

  function getGrade5ExamTasks() {
    return [
      spellTask('Экзамен в 5 класс. Русский язык 4 класса: собери слово "текст".', 'текст'),
      spellTask('Экзамен в 5 класс. Русский язык 4 класса: собери слово "падеж".', 'падеж'),
      spellTask('Экзамен в 5 класс. Русский язык 4 класса: собери слово "корень".', 'корень'),
      spellTask('Экзамен в 5 класс. Русский язык 4 класса: собери слово "глагол".', 'глагол'),
      spellTask('Экзамен в 5 класс. Русский язык 4 класса: собери слово "основа".', 'основа'),

      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.LEAF, BLOCK.WATER], text: 'Экзамен в 5 класс. Литературное чтение 4 класса: покажи лесную сцену рассказа - дерево, листья и воду.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.WOOD, BLOCK.STONE], text: 'Экзамен в 5 класс. Литературное чтение 4 класса: построй место действия - дом, порог и крепкую основу.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.WATER, BLOCK.GRASS], text: 'Экзамен в 5 класс. Литературное чтение 4 класса: покажи берег из текста - песок, воду и траву.' },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.LEAF, BLOCK.SMALL_WHITE_MUSHROOM], text: 'Экзамен в 5 класс. Литературное чтение 4 класса: найди детали описания - землю, листья и гриб.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.WOOD, BLOCK.LEAF], text: 'Экзамен в 5 класс. Литературное чтение 4 класса: собери краткий план сцены блоками.' },

      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.WOOD, BLOCK.WOOD, BLOCK.WOOD], text: 'Экзамен в 5 класс. Математика 4 класса: используй калькулятор и покажи сложение трех одинаковых слагаемых тремя деревянными блоками.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.STONE, BLOCK.STONE, BLOCK.WOOD, BLOCK.WOOD], text: 'Экзамен в 5 класс. Математика 4 класса: покажи сравнение двух групп - две каменные и две деревянные единицы.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK], text: 'Экзамен в 5 класс. Математика 4 класса: покажи площадь прямоугольника моделью из четырех досок.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.SAND, BLOCK.SAND, BLOCK.WATER], text: 'Экзамен в 5 класс. Математика 4 класса: покажи задачу цена-количество-стоимость двумя товарами и итогом.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.STONE, BLOCK.STONE, BLOCK.STONE, BLOCK.STONE, BLOCK.STONE], text: 'Экзамен в 5 класс. Математика 4 класса: покажи движение по числовому лучу пятью каменными шагами.' },

      { type: 'near', block: BLOCK.WATER, count: 1, text: 'Экзамен в 5 класс. Окружающий мир 4 класса: найди воду как природный объект.' },
      { type: 'near', block: BLOCK.LEAF, count: 1, text: 'Экзамен в 5 класс. Окружающий мир 4 класса: подойди к листьям и вспомни растения.' },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.WATER, BLOCK.LEAF], text: 'Экзамен в 5 класс. Окружающий мир 4 класса: покажи почву, воду и растение как части природы.' },
      { type: 'biome', biome: 'mountains', text: 'Экзамен в 5 класс. Окружающий мир 4 класса: найди горы на местности.' },
      { type: 'placeSet', blocks: [BLOCK.GLOBE, BLOCK.WATER, BLOCK.SAND], text: 'Экзамен в 5 класс. Окружающий мир 4 класса: поставь глобус, воду и сушу для повторения карты.' },

      spellTask('Экзамен в 5 класс. Иностранный язык 4 класса: собери слово "school" - школа.', 'school', 'en'),
      spellTask('Экзамен в 5 класс. Иностранный язык 4 класса: собери слово "family" - семья.', 'family', 'en'),
      spellTask('Экзамен в 5 класс. Иностранный язык 4 класса: собери слово "apple" - яблоко.', 'apple', 'en'),
      spellTask('Экзамен в 5 класс. Иностранный язык 4 класса: собери слово "city" - город.', 'city', 'en'),
      spellTask('Экзамен в 5 класс. Иностранный язык 4 класса: собери слово "green" - зеленый.', 'green', 'en'),

      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.STONE], text: 'Grade 5 entry exam. English reading: read "Put dirt near stone." Поставь землю рядом с камнем.' },
      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.LEAF], text: 'Grade 5 entry exam. English reading: read "The leaf is on the wood." Поставь лист и дерево.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.WATER], text: 'Grade 5 entry exam. English reading: read "Sand is near water." Поставь песок и воду.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.WOOD, BLOCK.STONE], text: 'Grade 5 entry exam. English reading: read "Build a small house." Поставь доску, дерево и камень.' },
      { type: 'placeSet', blocks: [BLOCK.GRASS, BLOCK.LEAF, BLOCK.WATER], text: 'Grade 5 entry exam. English reading: read "Green grass and a leaf are by water." Поставь траву, лист и воду.' },

      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.WOOD, BLOCK.PLANK, BLOCK.PLANK], text: 'Экзамен в 5 класс. Творчество 4 класса: сделай основание маленькой постройки.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.STONE, BLOCK.WOOD, BLOCK.WOOD], text: 'Экзамен в 5 класс. Творчество 4 класса: добавь опоры и крепкую часть.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.PLANK, BLOCK.LEAF], text: 'Экзамен в 5 класс. Творчество 4 класса: добавь форму и украшение.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.WATER, BLOCK.LEAF], text: 'Экзамен в 5 класс. Творчество 4 класса: оформи участок рядом с постройкой.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.WOOD, BLOCK.PLANK, BLOCK.LEAF], text: 'Экзамен в 5 класс. Творчество 4 класса: заверши итоговую мини-композицию.' },
    ];
  }

  function getGrade6ExamTasks() {
    return [
      spellTask('Экзамен в 6 класс. Русский язык 5 класса: собери слово "фонетика".', 'фонетика'),
      spellTask('Экзамен в 6 класс. Русский язык 5 класса: собери слово "лексика".', 'лексика'),
      spellTask('Экзамен в 6 класс. Русский язык 5 класса: собери слово "суффикс".', 'суффикс'),
      spellTask('Экзамен в 6 класс. Русский язык 5 класса: собери слово "подлежащее".', 'подлежащее'),
      spellTask('Экзамен в 6 класс. Русский язык 5 класса: собери слово "сказуемое".', 'сказуемое'),

      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.STONE], text: 'Экзамен в 6 класс. Литература 5 класса: покажи место древнего мифа - песок и камень.' },
      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.LEAF, BLOCK.WATER], text: 'Экзамен в 6 класс. Литература 5 класса: собери природную сцену рассказа.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.WOOD, BLOCK.CHEST], text: 'Экзамен в 6 класс. Литература 5 класса: покажи дом героя и важную деталь.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.PILLAR, BLOCK.SAND], text: 'Экзамен в 6 класс. Литература 5 класса: построй место легенды или басни.' },
      { type: 'placeSet', blocks: [BLOCK.PATH, BLOCK.LEAF, BLOCK.WATER], text: 'Экзамен в 6 класс. Литература 5 класса: покажи путь героя через природу.' },

      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.WOOD, BLOCK.WOOD, BLOCK.WOOD, BLOCK.WOOD], text: 'Экзамен в 6 класс. Математика 5 класса: используй калькулятор и покажи четыре одинаковые единицы.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.PLANK, BLOCK.PLANK, BLOCK.STONE, BLOCK.STONE], text: 'Экзамен в 6 класс. Математика 5 класса: покажи сравнение двух равных частей.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.SAND, BLOCK.SAND, BLOCK.SAND, BLOCK.WATER], text: 'Экзамен в 6 класс. Математика 5 класса: покажи модель дроби - три части и целое.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.STONE, BLOCK.STONE, BLOCK.STONE, BLOCK.STONE, BLOCK.STONE, BLOCK.STONE], text: 'Экзамен в 6 класс. Математика 5 класса: покажи числовой луч из шести шагов.' },
      { type: 'placeSet', blocks: [BLOCK.CALCULATOR, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK], text: 'Экзамен в 6 класс. Математика 5 класса: покажи периметр или площадь моделью из пяти досок.' },

      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.STONE, BLOCK.WOOD], text: 'Экзамен в 6 класс. История 5 класса: собери стоянку древних людей.' },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.WOOD, BLOCK.LEAF], text: 'Экзамен в 6 класс. История 5 класса: покажи переход к земледелию.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.CHEST, BLOCK.GOLDEN_FLOWER], text: 'Экзамен в 6 класс. История 5 класса: покажи обмен товарами и ремесло.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.BLACKSTONE, BLOCK.PLANK], text: 'Экзамен в 6 класс. История 5 класса: построй стену древнего города.' },
      { type: 'placeSet', blocks: [BLOCK.PILLAR, BLOCK.STONE, BLOCK.SAND], text: 'Экзамен в 6 класс. История 5 класса: покажи площадь древнего государства.' },

      { type: 'place', block: BLOCK.GLOBE, count: 1, text: 'Экзамен в 6 класс. География 5 класса: поставь глобус.' },
      { type: 'near', block: BLOCK.WATER, count: 1, text: 'Экзамен в 6 класс. География 5 класса: найди воду как модель реки или океана.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.WATER, BLOCK.STONE], text: 'Экзамен в 6 класс. География 5 класса: собери условную карту суши, воды и гор.' },
      { type: 'biome', biome: 'mountains', text: 'Экзамен в 6 класс. География 5 класса: найди биом Горы.' },
      { type: 'placeSet', blocks: [BLOCK.GLOBE, BLOCK.WATER, BLOCK.SAND], text: 'Экзамен в 6 класс. География 5 класса: покажи глобус, океан и сушу.' },

      { type: 'placeSet', blocks: [BLOCK.LEAF, BLOCK.WATER, BLOCK.DIRT], text: 'Экзамен в 6 класс. Биология 5 класса: покажи растение, воду и почву.' },
      { type: 'placeSet', blocks: [BLOCK.MOSS, BLOCK.SMALL_WHITE_MUSHROOM, BLOCK.DIRT], text: 'Экзамен в 6 класс. Биология 5 класса: покажи мох, гриб и лесную подстилку.' },
      { type: 'placeSet', blocks: [BLOCK.WATER, BLOCK.ALGAE, BLOCK.LEAF], text: 'Экзамен в 6 класс. Биология 5 класса: покажи водную среду и растения.' },
      { type: 'nearMob', mob: 'sheep', text: 'Экзамен в 6 класс. Биология 5 класса: подойди к овце как к объекту наблюдения.' },
      { type: 'nearMob', mob: 'goat', text: 'Экзамен в 6 класс. Биология 5 класса: подойди к козе как к объекту наблюдения.' },

      spellTask('Экзамен в 6 класс. Иностранный язык 5 класса: собери слово "teacher" - учитель.', 'teacher', 'en'),
      spellTask('Экзамен в 6 класс. Иностранный язык 5 класса: собери слово "homework" - домашняя работа.', 'homework', 'en'),
      spellTask('Экзамен в 6 класс. Иностранный язык 5 класса: собери слово "market" - рынок.', 'market', 'en'),
      spellTask('Экзамен в 6 класс. Иностранный язык 5 класса: собери слово "weather" - погода.', 'weather', 'en'),
      spellTask('Экзамен в 6 класс. Иностранный язык 5 класса: собери слово "travel" - путешествие.', 'travel', 'en'),

      { type: 'placeSet', blocks: [BLOCK.WOOD, BLOCK.PLANK], text: 'Grade 6 entry exam. English reading: read "Build with wood and plank." Поставь дерево и доску.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.SAND, BLOCK.WATER], text: 'Grade 6 entry exam. English reading: read "Stone and sand are near water." Поставь камень, песок и воду.' },
      { type: 'placeSet', blocks: [BLOCK.LEAF, BLOCK.WOOD, BLOCK.GRASS], text: 'Grade 6 entry exam. English reading: read "A tree has leaves by grass." Поставь лист, дерево и траву.' },
      { type: 'placeSet', blocks: [BLOCK.DIRT, BLOCK.WATER, BLOCK.LEAF], text: 'Grade 6 entry exam. English reading: read "A plant needs dirt and water." Поставь землю, воду и лист.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.CHEST, BLOCK.WOOD], text: 'Grade 6 entry exam. English reading: read "The chest is in a small wooden house." Поставь доску, сундук и дерево.' },

      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.STONE, BLOCK.WOOD, BLOCK.WOOD], text: 'Экзамен в 6 класс. Творчество 5 класса: сделай прочное основание.' },
      { type: 'placeSet', blocks: [BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK, BLOCK.LEAF], text: 'Экзамен в 6 класс. Творчество 5 класса: добавь форму и украшение.' },
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.WATER, BLOCK.LEAF, BLOCK.STONE], text: 'Экзамен в 6 класс. Творчество 5 класса: оформи сцену вокруг постройки.' },
      { type: 'placeSet', blocks: [BLOCK.PILLAR, BLOCK.STONE, BLOCK.PLANK, BLOCK.WOOD], text: 'Экзамен в 6 класс. Творчество 5 класса: добавь симметричную деталь.' },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.WOOD, BLOCK.PLANK, BLOCK.LEAF, BLOCK.WATER], text: 'Экзамен в 6 класс. Творчество 5 класса: заверши итоговую композицию.' },
    ];
  }

  function measureTask(text, minDistance) {
    return {
      type: 'measureDistance',
      minDistance,
      text,
    };
  }

  function lessonInformaticsTasks(lesson, grade = 1) {
    const groups = Number(grade) <= 2
      ? [
        { title: 'Клавиатура и мышь', items: ['ENTER', 'ESC', 'SHIFT', 'CTRL', 'ALT', 'TAB', 'SPACE', 'CLICK', 'MOUSE', 'KEY'] },
        { title: 'Окна и кнопки', items: ['WINDOW', 'BUTTON', 'MENU', 'FILE', 'SAVE', 'OPEN', 'CLOSE', 'PRINT', 'HOME', 'END'] },
      ]
      : (Number(grade) <= 4
        ? [
          { title: 'Горячие клавиши', items: ['CTRL Z', 'CTRL C', 'CTRL V', 'CTRL S', 'CTRL F', 'CTRL M', 'SHIFT TAB', 'ALT TAB', 'ENTER', 'ESC'] },
          { title: 'Файл и поиск', items: ['FILE', 'FOLDER', 'SEARCH', 'SAVE', 'COPY', 'PASTE', 'UNDO', 'PIXEL', 'TABLE', 'SCREEN'] },
        ]
        : [
          { title: 'Алгоритмы и данные', items: ['ALGORITHM', 'COMMAND', 'LOOP', 'IF THEN', 'DATA', 'CODE', 'TABLE', 'MODEL', 'BINARY', 'LOGIC'] },
          { title: 'Координаты и программы', items: ['PROGRAM', 'VARIABLE', 'INPUT', 'OUTPUT', 'GRAPH', 'COORD', 'DEBUG', 'SCRIPT', 'ARRAY', 'NETWORK'] },
        ]);
    const group = groups[(Math.floor((lesson - 1) / 20)) % groups.length];
    return Array.from({ length: 10 }, (_, index) => {
      const item = group.items[(lesson + index - 1) % group.items.length];
      return spellTask(`Информатика, ${grade} класс, урок ${lesson}. Тема: ${group.title}. Собери "${item}" английскими буквами-блоками.`, item, 'en');
    });
  }

  function lessonGrade7AlgebraTasks(lesson) {
    const base = lessonGrade5MathTasks(Math.min(100, lesson + 32));
    return base.map((task) => ({
      ...task,
      text: `Алгебра, 7 класс. ${task.text.replace('Математика, 5 класс', 'Повторение')}`,
    }));
  }

  function lessonGrade7GeometryTasks(lesson) {
    const distance = 2 + (lesson % 6);
    return [
      measureTask(`Геометрия, 7 класс, урок ${lesson}. Поставь линейку в первой точке, потом во второй и измерь отрезок не меньше ${distance} блоков.`, distance),
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.STONE, BLOCK.STONE], text: `Геометрия, 7 класс, урок ${lesson}. Покажи отрезок: линейка и две точки из камня.` },
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK], text: `Геометрия, 7 класс, урок ${lesson}. Построй ломаную из трех досок и используй линейку.` },
      measureTask(`Геометрия, 7 класс, урок ${lesson}. Измерь расстояние между двумя блоками не меньше ${distance + 1} блоков.`, distance + 1),
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.SAND, BLOCK.SAND, BLOCK.STONE], text: `Геометрия, 7 класс, урок ${lesson}. Покажи треугольник тремя точками и линейкой.` },
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK, BLOCK.PLANK], text: `Геометрия, 7 класс, урок ${lesson}. Покажи прямоугольник четырьмя досками и линейкой.` },
      measureTask(`Геометрия, 7 класс, урок ${lesson}. Измерь длинный отрезок не меньше ${distance + 2} блоков.`, distance + 2),
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.WOOD, BLOCK.WOOD, BLOCK.LEAF], text: `Геометрия, 7 класс, урок ${lesson}. Построй схему угла из двух лучей и отметь вершину.` },
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.STONE, BLOCK.PLANK, BLOCK.SAND], text: `Геометрия, 7 класс, урок ${lesson}. Сравни три стороны разными блоками.` },
      measureTask(`Геометрия, 7 класс, урок ${lesson}. Итог: измерь любой отрезок не меньше ${distance} блоков.`, distance),
    ];
  }

  function lessonGrade7PhysicsTasks(lesson) {
    const distance = 3 + (lesson % 5);
    return [
      measureTask(`Физика, 7 класс, урок ${lesson}. Измерь путь линейкой: поставь две линейки на расстоянии не меньше ${distance} блоков.`, distance),
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.STONE, BLOCK.WOOD], text: `Физика, 7 класс, урок ${lesson}. Покажи опыт измерения: линейка, тело и опора.` },
      { type: 'placeSet', blocks: [BLOCK.WATER, BLOCK.STONE, BLOCK.RULER], text: `Физика, 7 класс, урок ${lesson}. Сравни вещество и тело: вода, камень и линейка.` },
      measureTask(`Физика, 7 класс, урок ${lesson}. Измерь расстояние для опыта не меньше ${distance + 1} блоков.`, distance + 1),
      { type: 'placeSet', blocks: [BLOCK.SAND, BLOCK.STONE, BLOCK.WOOD], text: `Физика, 7 класс, урок ${lesson}. Покажи разные материалы для наблюдения.` },
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.PLANK, BLOCK.PLANK, BLOCK.STONE], text: `Физика, 7 класс, урок ${lesson}. Построй простую дорожку и тело на ней.` },
      measureTask(`Физика, 7 класс, урок ${lesson}. Измерь перемещение не меньше ${distance + 2} блоков.`, distance + 2),
      { type: 'placeSet', blocks: [BLOCK.RULER, BLOCK.WATER, BLOCK.SAND], text: `Физика, 7 класс, урок ${lesson}. Покажи наблюдение воды и песка с измерением.` },
      { type: 'placeSet', blocks: [BLOCK.STONE, BLOCK.STONE, BLOCK.RULER], text: `Физика, 7 класс, урок ${lesson}. Сравни две точки и инструмент измерения.` },
      measureTask(`Физика, 7 класс, урок ${lesson}. Итог: измерь путь не меньше ${distance} блоков.`, distance),
    ];
  }

  function getLessonTasks(subjectId, lesson, grade = 1) {
    const subject = subjectById(subjectId, grade).id;
    const safeLesson = clampLesson(lesson);
    if (Number(grade) === 7) {
      if (subject === 'language') return lessonGrade5LanguageTasks(Math.min(100, safeLesson + 36)).map((task) => ({ ...task, text: task.text.replace('5 класс', '7 класс') }));
      if (subject === 'literature') return lessonGrade3ReadingTasks(Math.min(100, safeLesson + 48)).map((task) => ({ ...task, text: `Литература, 7 класс. ${task.text}` }));
      if (subject === 'algebra') return lessonGrade7AlgebraTasks(safeLesson);
      if (subject === 'geometry') return lessonGrade7GeometryTasks(safeLesson);
      if (subject === 'history') return lessonGrade5HistoryTasks(Math.min(100, safeLesson + 36)).map((task) => ({ ...task, text: task.text.replace('5 класс', '7 класс') }));
      if (subject === 'geography') return lessonGrade5GeographyTasks(Math.min(100, safeLesson + 36)).map((task) => ({ ...task, text: task.text.replace('5 класс', '7 класс') }));
      if (subject === 'biology') return lessonGrade5BiologyTasks(Math.min(100, safeLesson + 36)).map((task) => ({ ...task, text: task.text.replace('5 класс', '7 класс') }));
      if (subject === 'physics') return lessonGrade7PhysicsTasks(safeLesson);
      if (subject === 'informatics') return lessonInformaticsTasks(safeLesson, 7);
      if (subject === 'foreign') return lessonGrade5ForeignTasks(Math.min(100, safeLesson + 36)).map((task) => ({ ...task, text: task.text.replace('5 класс', '7 класс') }));
      if (subject === 'english_reading') return lessonEnglishReadingTasks(safeLesson);
      if (subject === 'creative') return lessonGrade3CreativeTasks(Math.min(100, safeLesson + 60)).map((task) => ({ ...task, text: task.text.replace('3 класс', '7 класс') }));
    }
    if (Number(grade) === 6) {
      if (subject === 'language') return lessonGrade5LanguageTasks(Math.min(100, safeLesson + 18)).map((task) => ({ ...task, text: task.text.replace('5 класс', '6 класс') }));
      if (subject === 'literature') return lessonGrade3ReadingTasks(Math.min(100, safeLesson + 36)).map((task) => ({ ...task, text: `Литература, 6 класс. ${task.text}` }));
      if (subject === 'foreign') return lessonGrade5ForeignTasks(Math.min(100, safeLesson + 18)).map((task) => ({ ...task, text: task.text.replace('5 класс', '6 класс') }));
      if (subject === 'english_reading') return lessonEnglishReadingTasks(safeLesson);
      if (subject === 'math') return lessonGrade5MathTasks(Math.min(100, safeLesson + 18)).map((task) => ({ ...task, text: task.text.replace('5 класс', '6 класс') }));
      if (subject === 'history') return lessonGrade5HistoryTasks(Math.min(100, safeLesson + 18)).map((task) => ({ ...task, text: task.text.replace('5 класс', '6 класс') }));
      if (subject === 'geography') return lessonGrade5GeographyTasks(Math.min(100, safeLesson + 18)).map((task) => ({ ...task, text: task.text.replace('5 класс', '6 класс') }));
      if (subject === 'biology') return lessonGrade5BiologyTasks(Math.min(100, safeLesson + 18)).map((task) => ({ ...task, text: task.text.replace('5 класс', '6 класс') }));
      if (subject === 'informatics') return lessonInformaticsTasks(safeLesson, 6);
      if (subject === 'creative') return lessonGrade3CreativeTasks(Math.min(100, safeLesson + 48)).map((task) => ({ ...task, text: task.text.replace('3 класс', '6 класс') }));
    }
    if (Number(grade) === 5) {
      if (subject === 'language') return lessonGrade5LanguageTasks(safeLesson);
      if (subject === 'literature') return lessonGrade3ReadingTasks(Math.min(100, safeLesson + 24)).map((task) => ({ ...task, text: `Литература, 5 класс. ${task.text}` }));
      if (subject === 'foreign') return lessonGrade5ForeignTasks(safeLesson);
      if (subject === 'english_reading') return lessonEnglishReadingTasks(safeLesson);
      if (subject === 'math') return lessonGrade5MathTasks(safeLesson);
      if (subject === 'history') return lessonGrade5HistoryTasks(safeLesson);
      if (subject === 'geography') return lessonGrade5GeographyTasks(safeLesson);
      if (subject === 'biology') return lessonGrade5BiologyTasks(safeLesson);
      if (subject === 'informatics') return lessonInformaticsTasks(safeLesson, 5);
      if (subject === 'creative') return lessonGrade3CreativeTasks(safeLesson);
    }
    if (Number(grade) === 4) {
      if (subject === 'language') return lessonGrade4LanguageTasks(safeLesson);
      if (subject === 'literary_reading') return lessonGrade3ReadingTasks(safeLesson);
      if (subject === 'foreign') return lessonGrade4ForeignTasks(safeLesson);
      if (subject === 'english_reading') return lessonEnglishReadingTasks(safeLesson);
      if (subject === 'math') return lessonGrade4MathTasks(safeLesson);
      if (subject === 'world') return lessonGrade3WorldTasks(safeLesson);
      if (subject === 'informatics') return lessonInformaticsTasks(safeLesson, 4);
      if (subject === 'creative') return lessonGrade3CreativeTasks(safeLesson);
    }
    if (Number(grade) === 3) {
      if (subject === 'language') return lessonGrade3LanguageTasks(safeLesson);
      if (subject === 'literary_reading') return lessonGrade3ReadingTasks(safeLesson);
      if (subject === 'foreign') return lessonGrade3ForeignTasks(safeLesson);
      if (subject === 'math') return lessonGrade3MathTasks(safeLesson);
      if (subject === 'world') return lessonGrade3WorldTasks(safeLesson);
      if (subject === 'informatics') return lessonInformaticsTasks(safeLesson, 3);
      if (subject === 'creative') return lessonGrade3CreativeTasks(safeLesson);
    }
    if (Number(grade) === 2) {
      if (subject === 'language') return lessonGrade2LanguageTasks(safeLesson);
      if (subject === 'literary_reading') return lessonGrade2ReadingTasks(safeLesson);
      if (subject === 'foreign') return lessonGrade2ForeignTasks(safeLesson);
      if (subject === 'math') return lessonGrade2MathTasks(safeLesson);
      if (subject === 'world') return lessonGrade2WorldTasks(safeLesson);
      if (subject === 'informatics') return lessonInformaticsTasks(safeLesson, 2);
      if (subject === 'creative') return lessonGrade2CreativeTasks(safeLesson);
    }
    if (subject === 'language') return lessonLanguageTasks(safeLesson);
    if (subject === 'math') return lessonMathTasks(safeLesson, 1);
    if (subject === 'world') return lessonWorldTasks(safeLesson);
    if (subject === 'reading') return lessonReadingTasks(safeLesson);
    if (subject === 'informatics') return lessonInformaticsTasks(safeLesson, 1);
    if (subject === 'foreign') return lessonGrade1ForeignTasks(safeLesson);
    if (subject === 'creative') return lessonCreativeTasks(safeLesson);
    const base = TASKS[subject] || TASKS.math;
    return base.map((task, index) => withLessonText(task, safeLesson, index));
  }

  function setNotice(state, text) {
    if (!state || !state.ui) return;
    state.ui.noticeText = text;
    state.ui.noticeTimer = 1.6;
  }

  function customLessonRuntime(state) {
    const play = state && state.worldMeta ? state.worldMeta.customLessonPlay : null;
    if (!play) return null;
    if (!play.runtime || typeof play.runtime !== 'object') {
      play.code = normalizeCustomLessonCode(play.code);
      play.runtime = {
        actionIndex: 0,
        startedAction: 0,
        message: '',
        progress: {},
        completed: false,
      };
    }
    if (typeof play.runtime.message !== 'string') play.runtime.message = '';
    return play;
  }

  function blockIdByName(name) {
    if (Number.isFinite(Number(name))) return Number(name);
    const wanted = String(name || '').trim().toLowerCase();
    if (!wanted) return null;
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS ? Game.interaction3d.BLOCK_LABELS : {};
    for (const key of Object.keys(labels)) {
      if (String(labels[key]).toLowerCase() === wanted) return Number(key);
    }
    for (const key of Object.keys(BLOCK)) {
      if (key.toLowerCase() === wanted) return BLOCK[key];
    }
    return null;
  }

  function biomeMatchesName(biome, name) {
    const wanted = String(name || '').trim().toLowerCase();
    const id = String(biome || '').trim().toLowerCase();
    if (!wanted || !id) return false;
    if (wanted === id) return true;
    const labels = Game.generation3d && Game.generation3d.BIOME_LABELS ? Game.generation3d.BIOME_LABELS : {};
    return String(labels[biome] || '').trim().toLowerCase() === wanted;
  }

  function giveCustomLessonItem(state, command) {
    const id = command.itemId !== null && command.itemId !== undefined && command.itemId !== '' && Number.isFinite(Number(command.itemId))
      ? Number(command.itemId)
      : blockIdByName(command.item);
    if (!Number.isFinite(id) || !state || !state.player || !Game.inventory3d) return;
    const hotbar = Game.inventory3d.ensureHotbar ? Game.inventory3d.ensureHotbar(state) : state.player.hotbar;
    if (!Array.isArray(hotbar)) return;
    const index = Math.max(0, Math.min(hotbar.length - 1, (Number(command.slot) || 1) - 1));
    hotbar[index] = { id, count: 100 };
    if (Game.inventory3d.updateSelectedBlockFromHotbar) Game.inventory3d.updateSelectedBlockFromHotbar(state);
  }

  function teleportCustomLessonPlayer(state, command) {
    if (!state || !state.player) return;
    const nums = String(command.coords || '').match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 3) return;
    state.player.x = Number(nums[0]);
    state.player.y = Number(nums[1]);
    state.player.z = Number(nums[2]);
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
  }

  function currentCustomLessonAction(play) {
    const actions = play && play.code && Array.isArray(play.code.actions) ? play.code.actions : [];
    return actions[play.runtime.actionIndex] || null;
  }

  function runCustomLessonStart(state, play) {
    const action = currentCustomLessonAction(play);
    if (!action || play.runtime.completed || play.runtime.startedAction === action.number) return;
    play.runtime.startedAction = action.number;
    play.runtime.progress = {};
    play.runtime.message = '';
    for (const command of action.start || []) {
      if (command.type === 'give') giveCustomLessonItem(state, command);
      else if (command.type === 'teleport') teleportCustomLessonPlayer(state, command);
      else if (command.type === 'say') {
        play.runtime.message = command.text || '';
        setNotice(state, command.text || '');
      }
    }
  }

  function completeCustomLessonActionIfReady(state, play, action) {
    const conditions = Array.isArray(action.complete) ? action.complete : [];
    if (!conditions.length) return;
    const done = conditions.every((condition, index) => !!play.runtime.progress[index]);
    if (!done) return;
    play.runtime.actionIndex += 1;
    play.runtime.progress = {};
    play.runtime.startedAction = 0;
    if (!currentCustomLessonAction(play)) {
      play.runtime.completed = true;
      setNotice(state, 'Пользовательский урок пройден');
    } else {
      setNotice(state, `Действие ${action.number} выполнено`);
    }
  }

  function onCustomLessonAction(state, type, blockId) {
    const play = customLessonRuntime(state);
    if (!play || play.runtime.completed) return;
    runCustomLessonStart(state, play);
    const action = currentCustomLessonAction(play);
    if (!action) return;
    const conditions = Array.isArray(action.complete) ? action.complete : [];
    const index = conditions.findIndex((condition, i) => {
      if (play.runtime.progress[i] || condition.type !== type) return false;
      const conditionBlockId = condition.blockId !== null && condition.blockId !== undefined && condition.blockId !== '' && Number.isFinite(Number(condition.blockId))
        ? Number(condition.blockId)
        : blockIdByName(condition.block);
      return conditionBlockId === blockId;
    });
    if (index < 0) return;
    play.runtime.progress[index] = true;
    completeCustomLessonActionIfReady(state, play, action);
  }

  function updateCustomLessonBiome(state) {
    const play = customLessonRuntime(state);
    if (!play || play.runtime.completed) return;
    runCustomLessonStart(state, play);
    const action = currentCustomLessonAction(play);
    if (!action || !Game.generation3d || !Game.generation3d.getBiomeAt3D) return;
    const biome = Game.generation3d.getBiomeAt3D(state, state.player.x || 0, state.player.z || 0);
    const conditions = Array.isArray(action.complete) ? action.complete : [];
    let changed = false;
    for (let i = 0; i < conditions.length; i += 1) {
      const condition = conditions[i];
      if (play.runtime.progress[i] || condition.type !== 'biome') continue;
      if (!biomeMatchesName(biome, condition.biome)) continue;
      play.runtime.progress[i] = true;
      changed = true;
    }
    if (changed) completeCustomLessonActionIfReady(state, play, action);
  }

  function customLessonHud(state) {
    const play = customLessonRuntime(state);
    if (!play) return null;
    const action = currentCustomLessonAction(play);
    const actions = play.code && Array.isArray(play.code.actions) ? play.code.actions : [];
    const conditions = action && Array.isArray(action.complete) ? action.complete : [];
    const progress = conditions.filter((condition, index) => !!play.runtime.progress[index]).length;
    const actionCount = Math.max(1, actions.length);
    const completedActions = play.runtime.completed
      ? actionCount
      : Math.max(0, Math.min(actionCount, Number(play.runtime.actionIndex) || 0));
    return {
      subject: play.title || 'Пользовательский урок',
      country: 'свой курс',
      grade: Number(play.grade) || 1,
      lesson: action ? action.number : Math.max(1, play.runtime.actionIndex + 1),
      coins: completedActions,
      passCoins: actionCount,
      completed: !!play.runtime.completed,
      taskText: play.runtime.completed
        ? 'Урок пройден.'
        : (action ? (play.runtime.message || `Выполни все условия действия ${action.number}.`) : 'Нет действий в коде урока.'),
      taskProgress: play.runtime.completed ? (conditions.length || 1) : progress,
      taskCount: conditions.length || 1,
      creativePreview: null,
    };
  }

  function awardCoin(state) {
    const education = ensureEducation(state);
    if (!education || education.completed) return;
    const passCoins = education.passCoins || PASS_COINS;
    education.coins = Math.min(passCoins, education.coins + 1);
    education.taskIndex += 1;
    education.taskProgress = 0;
    education.taskProgressMap = {};
    if (education.coins >= passCoins) {
      education.completed = true;
      if (education.exam === 'grade5') {
        markGrade5ExamCompleted(education.countryId);
        setNotice(state, `Экзамен сдан: ${passCoins}/${passCoins} монет`);
      } else if (education.exam === 'grade6') {
        markGrade6ExamCompleted(education.countryId);
        setNotice(state, `Экзамен сдан: ${passCoins}/${passCoins} монет`);
      } else {
        markCompleted(education.countryId, education.grade, education.subjectId, education.lesson);
        setNotice(state, `Урок пройден: ${passCoins}/${passCoins} монет`);
      }
      return;
    }
    setNotice(state, `+1 монета (${education.coins}/${passCoins})`);
  }

  function onAction(state, type, blockId) {
    const education = ensureEducation(state);
    if (!education || education.completed) return;
    const task = currentTask(education);
    if (!task) return;
    if (task.type === 'placeSet' && type === 'place') {
      const blocks = Array.isArray(task.blocks) ? task.blocks : [];
      const index = blocks.findIndex((id, i) => id === blockId && !education.taskProgressMap[i]);
      if (index < 0) return;
      education.taskProgressMap[index] = true;
      education.taskProgress = Object.keys(education.taskProgressMap).length;
      if (education.taskProgress >= blocks.length) awardCoin(state);
      return;
    }
    if (task.type === 'spellWord' && type === 'place') {
      const letters = Array.isArray(task.letters) ? task.letters : [];
      const index = letters.findIndex((id, i) => id === blockId && !education.taskProgressMap[i]);
      if (index < 0) return;
      education.taskProgressMap[index] = true;
      education.taskProgress = Object.keys(education.taskProgressMap).length;
      if (education.taskProgress >= letters.length) awardCoin(state);
      return;
    }
    if (task.type !== type || task.block !== blockId) return;
    education.taskProgress = Math.min(task.count, (education.taskProgress || 0) + 1);
    if (education.taskProgress >= task.count) awardCoin(state);
  }

  function onBlockPlaced(state, blockId) {
    onCustomLessonAction(state, 'place', blockId);
    onAction(state, 'place', blockId);
  }

  function onBlockMined(state, blockId) {
    onCustomLessonAction(state, 'mine', blockId);
    onAction(state, 'mine', blockId);
  }

  function onRulerMeasured(state, distance) {
    const education = ensureEducation(state);
    if (!education || education.completed) return;
    const task = currentTask(education);
    if (!task || task.type !== 'measureDistance') return;
    if (!Number.isFinite(distance) || distance < (task.minDistance || 1)) return;
    education.taskProgress = 1;
    awardCoin(state);
  }

  function hasNearbyBlock(state, blockId, radius = 3) {
    if (!state || !state.player || !state.world || !Game.world3d || !Game.world3d.getBlock3D) return false;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const pz = Math.floor(state.player.z);
    for (let y = py - 1; y <= py + 2; y += 1) {
      for (let z = pz - radius; z <= pz + radius; z += 1) {
        for (let x = px - radius; x <= px + radius; x += 1) {
          if (Game.world3d.getBlock3D(state, x, y, z) === blockId) return true;
        }
      }
    }
    return false;
  }

  function hasNearbyMob(state, mobType, radius = 5) {
    if (!state || !state.player || !state.entities || !Array.isArray(state.entities.sheep)) return false;
    const wanted = String(mobType || '').trim();
    const px = Number(state.player.x) || 0;
    const py = Number(state.player.y) || 0;
    const pz = Number(state.player.z) || 0;
    for (const mob of state.entities.sheep) {
      if (!mob || (wanted && mob.type !== wanted)) continue;
      const dx = (Number(mob.x) || 0) - px;
      const dy = (Number(mob.y) || 0) - py;
      const dz = (Number(mob.z) || 0) - pz;
      if ((dx * dx) + (dy * dy) + (dz * dz) <= radius * radius) return true;
    }
    return false;
  }

  function updateEducation(state) {
    updateCustomLessonBiome(state);
    const education = ensureEducation(state);
    if (!education || education.completed) return;
    syncEducationHotbar(state);
    const task = currentTask(education);
    if (task && task.type === 'near' && hasNearbyBlock(state, task.block)) awardCoin(state);
    if (task && task.type === 'nearMob' && hasNearbyMob(state, task.mob)) awardCoin(state);
    if (task && task.type === 'biome' && Game.generation3d && Game.generation3d.getBiomeAt3D) {
      const biome = Game.generation3d.getBiomeAt3D(state, state.player.x || 0, state.player.z || 0);
      if (biome === task.biome) awardCoin(state);
    }
  }

  function getHud(state) {
    const education = ensureEducation(state);
    if (!education) return customLessonHud(state);
    const task = currentTask(education);
    const passCoins = education.passCoins || PASS_COINS;
    const completedText = education.exam === 'grade5'
      ? 'Экзамен сдан. Теперь 5 класс открыт.'
      : (education.exam === 'grade6' ? 'Экзамен сдан. Теперь 6 класс открыт.' : 'Урок пройден. Вернись в меню обучения.');
    return {
      subject: education.subjectLabel,
      country: education.countryLabel,
      grade: education.grade,
      lesson: education.lesson,
      coins: education.coins,
      passCoins,
      completed: education.completed,
      taskText: education.completed ? completedText : (task ? task.text : ''),
      taskProgress: education.completed || !task ? passCoins : education.taskProgress,
      taskCount: task ? (task.type === 'placeSet' && Array.isArray(task.blocks) ? task.blocks.length : (task.type === 'spellWord' && Array.isArray(task.letters) ? task.letters.length : (task.type === 'biome' || task.type === 'nearMob' || task.type === 'measureDistance' ? 1 : task.count))) : passCoins,
      creativePreview: creativePreviewForTask(education),
    };
  }

  function getHotbarItems(education) {
    if (!education) return null;
    const task = currentTask(education);
    const defaultBlocks = [BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD, BLOCK.PLANK, BLOCK.WATER, BLOCK.SAND, BLOCK.LEAF, BLOCK.GRASS];
    const biologyBlocks = [BLOCK.LEAF, BLOCK.WOOD, BLOCK.WATER, BLOCK.DIRT, BLOCK.MOSS, BLOCK.SMALL_WHITE_MUSHROOM, BLOCK.ALGAE];
    const mathItems = (items) => uniqueBlocks([BLOCK.CALCULATOR, ...items]).slice(0, 10);
    const itemIds = Game.interaction3d && Game.interaction3d.ITEM ? Game.interaction3d.ITEM : {};
    const mobEggByType = {
      sheep: itemIds.SHEEP_SPAWN_EGG,
      boar: itemIds.BOAR_SPAWN_EGG,
      turtle: itemIds.TURTLE_SPAWN_EGG,
      snake: itemIds.SNAKE_SPAWN_EGG,
      goat: itemIds.GOAT_SPAWN_EGG,
      fish: itemIds.FISH_SPAWN_EGG,
      fox: itemIds.FOX_SPAWN_EGG,
      bear: itemIds.POLAR_BEAR_SPAWN_EGG,
    };
    if (task && task.type === 'spellWord') {
      const required = uniqueBlocks(task.letters || []);
      if (task.alphabet === 'en') {
        const fillers = deterministicShuffle(
          ENGLISH_HOTBAR.filter((id) => !required.includes(id)),
          education.lesson * 191 + education.taskIndex * 23,
        );
        return deterministicShuffle(
          uniqueBlocks([...required, ...fillers]).slice(0, 10),
          education.lesson * 223 + education.taskIndex * 29,
        );
      }
      if (education.subjectId === 'foreign') {
        const fillers = deterministicShuffle(
          LANGUAGE_HOTBAR.filter((id) => !required.includes(id)),
          education.lesson * 97 + education.taskIndex * 13,
        );
        return deterministicShuffle(
          uniqueBlocks([...required, ...fillers]).slice(0, 10),
          education.lesson * 131 + education.taskIndex * 17,
        );
      }
      return uniqueBlocks([
        ...required,
        ...LANGUAGE_HOTBAR,
        BLOCK.LETTER_N,
        BLOCK.LETTER_R,
        BLOCK.LETTER_U,
        BLOCK.LETTER_I,
      ]).slice(0, 10);
    }
    if (task && task.type === 'placeSet' && Array.isArray(task.blocks)) {
      const fillers = education.subjectId === 'english_reading'
        ? ENGLISH_READING_HOTBAR
        : (education.subjectId === 'biology' ? biologyBlocks : defaultBlocks);
      const items = uniqueBlocks([...task.blocks, ...fillers]);
      return education.subjectId === 'math' ? mathItems(items) : items.slice(0, 10);
    }
    if (task && task.type === 'measureDistance') {
      return uniqueBlocks([BLOCK.RULER, ...defaultBlocks]).slice(0, 10);
    }
    if (task && task.type === 'place' && Number.isFinite(task.block)) {
      const letter = Game.blocks.LETTER_BLOCKS && Game.blocks.LETTER_BLOCKS[task.block];
      const fillers = education.subjectId === 'english_reading'
        ? ENGLISH_READING_HOTBAR
        : (letter && /^[A-Z]$/.test(letter) ? ENGLISH_HOTBAR : defaultBlocks);
      const items = uniqueBlocks([task.block, ...fillers]);
      return education.subjectId === 'math' ? mathItems(items) : items.slice(0, 10);
    }
    if (education.subjectId === 'math') return mathItems(defaultBlocks);
    if (education.subjectId === 'algebra') return mathItems(defaultBlocks);
    if (education.subjectId === 'geometry' || education.subjectId === 'physics') return uniqueBlocks([BLOCK.RULER, ...defaultBlocks]).slice(0, 10);
    if (education.subjectId === 'geography') return uniqueBlocks([BLOCK.GLOBE, ...defaultBlocks, BLOCK.STONE, BLOCK.SNOW]).slice(0, 10);
    if ((education.subjectId === 'biology' || education.exam === 'grade6') && task && task.type === 'nearMob') {
      return uniqueBlocks([mobEggByType[task.mob], ...biologyBlocks]).slice(0, 10);
    }
    if (education.subjectId === 'biology') return biologyBlocks.slice(0, 10);
    if (education.subjectId === 'language') return LANGUAGE_HOTBAR.slice();
    if (education.subjectId === 'informatics') return ENGLISH_HOTBAR.slice(0, 10);
    if (education.subjectId === 'foreign' && Number(education.grade) === 1) return ENGLISH_HOTBAR.slice(0, 10);
    return null;
  }

  function syncEducationHotbar(state) {
    if (!state || !state.player || !state.worldMeta || state.worldMeta.mode !== 'education') return;
    const items = getHotbarItems(state.worldMeta.education);
    if (!Array.isArray(items) || !items.length) return;
    const hotbar = state.player.hotbar || [];
    let changed = hotbar.length !== 10;
    for (let i = 0; i < 10; i += 1) {
      const id = items[i];
      const current = hotbar[i];
      if (Number.isFinite(id)) {
        if (!current || current.id !== id || current.count !== 100) {
          hotbar[i] = { id, count: 100 };
          changed = true;
        }
      } else if (current) {
        hotbar[i] = null;
        changed = true;
      }
    }
    state.player.hotbar = hotbar;
    if (changed && Game.inventory3d && Game.inventory3d.updateSelectedBlockFromHotbar) {
      Game.inventory3d.updateSelectedBlockFromHotbar(state);
    }
  }

  Game.education3d = {
    COUNTRIES,
    SUBJECTS,
    getSubjects,
    PASS_COINS,
    GRADE5_EXAM_PASS_COINS,
    GRADE6_EXAM_PASS_COINS,
    LESSON_COUNT,
    createEducationMeta,
    createGrade5ExamMeta,
    createGrade6ExamMeta,
    isCompleted,
    isGrade5ExamCompleted,
    isGrade6ExamCompleted,
    markGrade5ExamCompleted,
    markGrade6ExamCompleted,
    isSubjectCompleted,
    completedLessonCount,
    customCoursesFor,
    customCourseById,
    customLessonById,
    createCustomCourse,
    createCustomLesson,
    saveCustomLesson,
    normalizeCustomLessonMode,
    normalizeCustomLessonSpawnMode,
    getSavedCountryId,
    saveCountryId,
    getLessonSummary,
    getGrade5ExamTasks,
    getGrade6ExamTasks,
    updateEducation,
    syncEducationHotbar,
    onBlockPlaced,
    onBlockMined,
    onRulerMeasured,
    getHud,
    getHotbarItems,
  };
})();
