'use client';

interface NPSScaleProps {
  value: number | null;
  onChange: (value: number) => void;
}

export default function NPSScale({ value, onChange }: NPSScaleProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {[...Array(11)].map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          type="button"
          className={`w-10 h-10 rounded-lg font-bold transition-all focus:outline-none ${
            value === i
              ? 'bg-green-600 text-white scale-110 shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
