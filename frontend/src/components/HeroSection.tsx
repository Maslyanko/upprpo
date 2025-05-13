import React from 'react';

const HeroSection: React.FC = () => {
  const tags = [
    '#Популярное', '#Python', '#ИскусственныйИнтеллект', '#SQL', '#JavaScript',
    '#ТаймМенеджмент', '#ДляНачинающих', '#Java', '#HTML', '#ПостроениеКарьерногоПути',
    '#СПрактикой', '#Docker', '#Креативность', '#БезОпыта'
  ];

  return (
    <div className="bg-orange-600 text-white flex flex-col items-center justify-center min-h-screen px-4 py-16 sm:py-24">
      <div className="text-center max-w-3xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
          Подготовься к IT-собеседованию
        </h1>
        <p className="text-lg sm:text-xl text-orange-100 mb-10">
          Получай мгновенную обратную связь на свои ответы и код.
          <br />
          Готовься эффективнее с AI-hunt.
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {tags.map(tag => (
            <span
              key={tag}
              className="bg-gray-900 bg-opacity-70 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full cursor-pointer hover:bg-opacity-90 transition-opacity"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;