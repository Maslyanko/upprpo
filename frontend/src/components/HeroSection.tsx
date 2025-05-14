// ==== File: frontend/src/components/HeroSection.tsx ====
// ===== ./src/components/HeroSection.tsx =====
import React, { useState, useEffect, useMemo } from 'react';
import { getAvailableTags } from '@/api/coursesApi';

interface HeroSectionProps {
  onTagClick: (tag: string) => void;
}

const generateMarqueeRowsData = (
  sourceTags: string[],
  numRows: number,
  minItemsPerVisualRow: number
): string[][] => {
  if (!sourceTags || sourceTags.length === 0) {
    const placeholderTag = "#Теги";
    return Array(numRows).fill(null).map(() => Array(minItemsPerVisualRow * 2).fill(placeholderTag)); // Увеличиваем для заглушки, чтобы заполнить трек
  }

  const rows: string[][] = [];
  for (let i = 0; i < numRows; i++) {
    const rowItems: string[] = [];
    let currentSourceIndex = i % sourceTags.length;
    // Нам нужно достаточно тегов, чтобы заполнить удвоенную ширину (для дублирования в треке)
    // minItemsPerVisualRow теперь примерно соответствует половине трека.
    // Умножаем на 2, чтобы точно хватило на дублирование.
    // И добавим еще небольшой запас, если теги разной длины.
    const itemsNeededForFullTrackLoop = Math.max(minItemsPerVisualRow * 2, sourceTags.length * 2);

    for (let j = 0; j < itemsNeededForFullTrackLoop; j++) {
      rowItems.push(sourceTags[currentSourceIndex]);
      currentSourceIndex = (currentSourceIndex + 1) % sourceTags.length;
    }
    rows.push(rowItems);
  }
  return rows;
};


const HeroSection: React.FC<HeroSectionProps> = ({ onTagClick }) => {
  const [tagsFromApi, setTagsFromApi] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState<boolean>(true);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const fallbackTags = [
    '#Популярное', '#Python', '#AI', '#SQL', '#JavaScript',
    '#ТаймМенеджмент', '#ДляНачинающих', '#Java', '#HTML', '#Карьера',
    '#Практика', '#Docker', '#Креативность', '#БезОпыта', '#Тестирование',
    '#DevOps', '#Frontend', '#Backend', '#DataScience', '#MobileDev'
  ];

  useEffect(() => {
    const fetchTags = async () => {
      setIsLoadingTags(true);
      setTagsError(null);
      try {
        const fetchedTags = await getAvailableTags();
        if (fetchedTags && fetchedTags.length > 0) {
          setTagsFromApi(fetchedTags.map(tag => `#${tag.trim()}`));
        } else {
          setTagsFromApi(fallbackTags);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
        setTagsError("Не удалось загрузить теги.");
        setTagsFromApi(fallbackTags);
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchTags();
  }, []);

  const handleInternalTagClick = (fullTag: string) => {
    const cleanTag = fullTag.startsWith('#') ? fullTag.substring(1) : fullTag;
    onTagClick(cleanTag);
  };

  // minItemsPerVisualRow теперь соответствует примерному количеству тегов,
  // чтобы заполнить ОДНУ видимую ширину экрана. Функция generateMarqueeRowsData
  // сама позаботится о достаточном количестве для дублирования.
  const marqueeRowsData = useMemo(() => {
    return generateMarqueeRowsData(tagsFromApi.length > 0 ? tagsFromApi : fallbackTags, 3, 20); // Увеличим немного minItems
  }, [tagsFromApi, fallbackTags]);

  const animationClasses = [
    'animate-marquee-medium',
    'animate-marquee-slow',
    'animate-marquee-fast'
  ];

  return (
    // Убираем px-* с этого контейнера, чтобы дочерние элементы могли растянуться на всю ширину
    <div className="bg-orange text-white flex flex-col justify-center min-h-[calc(100vh-4rem)] py-12 sm:py-16 relative overflow-hidden">
      {/* Основной контент (заголовок, подзаголовок) */}
      {/* Добавляем отступы сюда, чтобы контент не прилипал к краям */}
      <div className="max-w-3xl w-full z-10 relative px-4 sm:px-6 md:px-8 lg:px-16">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 whitespace-nowrap">
          Подготовься к IT-собеседованию
        </h1>
        <p className="text-lg sm:text-xl text-orange-100 mb-10 text-left">
          Получай мгновенную обратную связь на свои ответы и код.
          <br />
          Готовься эффективнее с AI-hunt.
        </p>
      </div>

      {/* Контейнер для всех "бегущих строк" тегов */}
      {/* Этот контейнер должен быть на всю ширину, без боковых отступов */}
      <div className="w-full mt-8 sm:mt-12 space-y-3 md:space-y-4 z-0 absolute inset-x-0 bottom-0 top-auto md:relative md:inset-auto md:top-auto md:bottom-auto"> {/* Попробуем абсолютно спозиционировать на мобильных */}
        {(isLoadingTags && tagsFromApi.length === 0) && (
           <p className="text-center text-orange-100 px-4">Загрузка популярных тегов...</p> // Добавим px, если сообщение будет видимо
        )}
        {tagsError && tagsFromApi.length === fallbackTags.length && (
           <p className="text-center text-red-300 px-4">{tagsError}</p> // Добавим px
        )}
        
        {marqueeRowsData.map((rowTags, rowIndex) => (
          // marquee-row теперь не должен ограничивать ширину, он сам по себе скрыт
          <div key={rowIndex} className="marquee-row w-full overflow-visible"> {/* ИЗМЕНЕНО: overflow-hidden на overflow-visible или убрать */}
            {/* 
              marquee-track должен быть шире, чем его родитель, чтобы анимация работала правильно.
              Он содержит ДВЕ копии контента.
              Ширина marquee-track устанавливается через min-w-[200%] или подобное,
              либо просто даем ему достаточно контента, чтобы он сам растянулся.
              В нашем случае, generateMarqueeRowsData уже должна генерировать достаточно тегов.
            */}
            <div className={`marquee-track flex ${animationClasses[rowIndex % animationClasses.length]} min-w-[200%] will-change-transform`}> {/* Добавлен min-w-[200%] и will-change-transform */}
              {/* Контент уже дублируется в generateMarqueeRowsData для упрощения */}
              {rowTags.map((tag, tagIndex) => (
                <button
                  key={`${rowIndex}-${tagIndex}-${tag}`}
                  onClick={() => handleInternalTagClick(tag)}
                  className="bg-gray-900 bg-opacity-60 hover:bg-opacity-80 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full cursor-pointer whitespace-nowrap mx-1.5 sm:mx-2 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-orange-300 focus:ring-opacity-50"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroSection;