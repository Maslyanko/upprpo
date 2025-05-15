// ==== File: frontend/src/components/HeroSection.tsx ====
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Добавили useCallback
import { getAvailableTags } from '@/api/coursesApi';

interface HeroSectionProps {
  onTagClick: (tag: string) => void;
}

// Функция для перемешивания массива (алгоритм Фишера-Йейтса)
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array]; // Создаем копию, чтобы не мутировать исходный массив
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const generateMarqueeRowsData = (
  sourceTags: string[],
  numRows: number,
  minItemsPerVisualRow: number
): string[][] => {
  if (!sourceTags || sourceTags.length === 0) {
    const placeholderTag = "#Теги";
    return Array(numRows).fill(null).map(() => Array(minItemsPerVisualRow * 2).fill(placeholderTag));
  }

  const rows: string[][] = [];
  for (let i = 0; i < numRows; i++) {
    // Перемешиваем исходные теги для каждой строки, чтобы строки отличались
    const shuffledSourceTags = shuffleArray(sourceTags);
    const rowItems: string[] = [];
    let currentSourceIndex = i % shuffledSourceTags.length; // Используем i для начального смещения в перемешанном массиве
    const itemsNeededForFullTrackLoop = Math.max(minItemsPerVisualRow * 2, shuffledSourceTags.length * 2);

    for (let j = 0; j < itemsNeededForFullTrackLoop; j++) {
      rowItems.push(shuffledSourceTags[currentSourceIndex]);
      currentSourceIndex = (currentSourceIndex + 1) % shuffledSourceTags.length;
    }
    rows.push(rowItems);
  }
  return rows;
};


const HeroSection: React.FC<HeroSectionProps> = ({ onTagClick }) => {
  const [tagsFromApi, setTagsFromApi] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState<boolean>(true);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const fallbackTags = useMemo(() => [
    '#Популярное', '#Python', '#AI', '#SQL', '#JavaScript',
    '#ТаймМенеджмент', '#ДляНачинающих', '#Java', '#HTML', '#Карьера',
    '#Практика', '#Docker', '#Креативность', '#БезОпыта', '#Тестирование',
    '#DevOps', '#Frontend', '#Backend', '#DataScience', '#MobileDev'
  ], []);

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
        setTagsFromApi(fallbackTags);
        setTagsError("Не удалось загрузить теги.");
      } finally {
        setIsLoadingTags(false);
      }
    };
    fetchTags();
  }, [fallbackTags]);

  const handleInternalTagClick = useCallback((fullTag: string) => { // useCallback для стабильности ссылки
    const cleanTag = fullTag.startsWith('#') ? fullTag.substring(1) : fullTag;
    onTagClick(cleanTag);
  }, [onTagClick]);

  const marqueeRowsData = useMemo(() => {
    const tagsToUse = (tagsFromApi.length > 0 && !isLoadingTags) ? tagsFromApi : fallbackTags;
    // Увеличим minItemsPerVisualRow, если теги стали крупнее, чтобы обеспечить заполнение
    return generateMarqueeRowsData(tagsToUse, 4, 15); // Уменьшил до 15, т.к. теги станут больше
  }, [tagsFromApi, fallbackTags, isLoadingTags]);

  const animationClasses = [
    'animate-marquee-medium',
    'animate-marquee-slow',
    'animate-marquee-fast',
  ];


  return (
    <div className="bg-orange text-white flex flex-col justify-center min-h-[calc(100vh-4rem)] py-12 sm:py-16 relative overflow-hidden">
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
      <div className="marquee-container w-full mt-8 sm:mt-12 space-y-3 md:space-y-4 absolute inset-x-0 bottom-0 md:relative md:inset-auto md:top-auto md:bottom-auto overflow-x-hidden">
        {isLoadingTags && tagsFromApi.length === 0 && (
           <p className="text-center text-orange-100 px-4">Загрузка популярных тегов...</p>
        )}
        {tagsError && (<p className="text-center text-red-200 px-4 text-sm">{tagsError}</p>)}

        {marqueeRowsData.map((rowTags, rowIndex) => (
          <div key={rowIndex} className="marquee-row w-full">
            <div className={`marquee-track flex ${animationClasses[rowIndex % animationClasses.length]} min-w-max will-change-transform`}>
              {rowTags.map((tag, tagIndex) => (
                <button
                  key={`row-${rowIndex}-tag-${tagIndex}-${tag.replace('#', '')}`}
                  onClick={() => handleInternalTagClick(tag)}
                  // --- УВЕЛИЧЕНИЕ РАЗМЕРА ТЕГОВ ---
                  // Было: text-xs sm:text-sm px-3 py-1.5
                  // Стало: text-sm sm:text-base px-4 py-2 (примерно в 1.5 раза больше padding и text size)
                  className="bg-gray-900 bg-opacity-60 hover:bg-opacity-80 text-white 
                             text-sm sm:text-sm font-medium px-4 py-2 sm:px-5 sm:py-2.5 rounded-full 
                             cursor-pointer whitespace-nowrap mx-2 sm:mx-3 
                             transition-colors duration-150 
                             focus:outline-none focus:ring-1 focus:ring-orange-300 focus:ring-opacity-50 
                             shrink-0"
                >
                  {tag}
                </button>
              ))}
              {/* Дублирование для плавной анимации, если generateMarqueeRowsData не генерирует достаточно */}
              {/* В нашем случае generateMarqueeRowsData должна справляться */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroSection;