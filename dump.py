#!/usr/bin/env python3
"""
bundle_react.py - Собирает значимый код React-фронтенда в один файл, исключая сторонние библиотеки.

Использование:
    python bundle_react.py --src PATH_TO_PROJECT --out OUTPUT_FILE --ext js jsx ts tsx
"""
import os
import argparse

# Список директорий, которые нужно пропускать (сторонние библиотеки и артефакты сборки)
EXCLUDE_DIRS = {
    'node_modules', '.git', 'build', 'dist', 'public', 'coverage', '__pycache__'
}

# Проверяем, является ли директория сторонней
def is_excluded_dir(dirname: str) -> bool:
    return dirname in EXCLUDE_DIRS

# Собираем файлы с заданными расширениями
def collect_files(src_dir: str, exts: list[str]) -> list[str]:
    collected = []
    for root, dirs, files in os.walk(src_dir):
        # Исключаем ненужные директории
        dirs[:] = [d for d in dirs if not is_excluded_dir(d)]
        for fname in files:
            if any(fname.lower().endswith(f'.{ext.lower()}') for ext in exts):
                collected.append(os.path.join(root, fname))
    return sorted(collected)

# Основная функция бандлинга
def main():
    parser = argparse.ArgumentParser(
        description='Bundle React frontend code into one file excluding third-party libraries'
    )
    parser.add_argument(
        '--src', '-s', default='.',
        help='Каталог с исходным кодом проекта'
    )
    parser.add_argument(
        '--out', '-o', default='bundle.js',
        help='Путь к выходному файлу'
    )
    parser.add_argument(
        '--ext', '-e', nargs='+', default=['js', 'jsx', 'ts', 'tsx'],
        help='Расширения файлов для включения (например, js jsx ts tsx)'
    )
    args = parser.parse_args()

    files = collect_files(args.src, args.ext)
    if not files:
        print('Не найдено файлов для объединения.')
        return

    with open(args.out, 'w', encoding='utf-8') as out_file:
        for filepath in files:
            rel_path = os.path.relpath(filepath, args.src)
            out_file.write(f'// ==== File: {rel_path} ====\n')
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    out_file.write(f.read())
            except Exception as e:
                print(f'Ошибка при чтении {rel_path}: {e}')
            out_file.write('\n\n')

    print(f'Bundled {len(files)} files into {args.out}')

if __name__ == '__main__':
    main()
