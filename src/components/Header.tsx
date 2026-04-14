interface HeaderProps {
  onImportClick: () => void;
}

export default function Header({ onImportClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200">
      <h1 className="text-xl font-bold text-blue-500 tracking-tight">
        SnapSort
      </h1>
      <button
        onClick={onImportClick}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 transition-colors"
        aria-label="사진 가져오기"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </header>
  );
}
