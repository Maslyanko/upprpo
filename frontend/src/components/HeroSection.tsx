// ==== File: frontend/src/components/HeroSection.tsx ====
// ===== ./src/components/HeroSection.tsx =====
import React from 'react';

interface HeroSectionProps {
  onTagClick: (tag: string) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onTagClick }) => {
  const tags = [
    '#Популярное', '#Python', '#ИскусственныйИнтеллект', '#SQL', '#JavaScript',
    '#ТаймМенеджмент', '#ДляНачинающих', '#Java', '#HTML', '#ПостроениеКарьерногоПути',
    '#СПрактикой', '#Docker', '#Креативность', '#БезОпыта'
  ];

  const handleInternalTagClick = (fullTag: string) => {
    // Remove '#' and pass the clean tag
    const cleanTag = fullTag.startsWith('#') ? fullTag.substring(1) : fullTag;
    onTagClick(cleanTag);
  };

  return (
    <div className="bg-orange text-white flex flex-col justify-center min-h-[calc(100vh-4rem)] px-4 sm:px-6 md:px-8 lg:px-16 py-12 sm:py-16"> {/* Убрал items-center, добавил отступы для разных экранов */}
      <div className="max-w-3xl w-full"> {/* Контейнер для контента, выровнен по левому краю родительского блока (с учетом его padding) */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 whitespace-nowrap"> {/* Добавлен whitespace-nowrap */}
          Подготовься к IT-собеседованию
        </h1>
        <p className="text-lg sm:text-xl text-orange-100 mb-10 text-left"> {/* Добавлен text-left */}
          Получай мгновенную обратную связь на свои ответы и код.
          <br />
          Готовься эффективнее с AI-hunt.
        </p>
        <div className="flex flex-wrap justify-start gap-2 sm:gap-3"> {/* Изменен justify-center на justify-start */}
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => handleInternalTagClick(tag)}
              className="bg-gray-900 bg-opacity-70 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full cursor-pointer hover:bg-opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-opacity-50"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;